import numpy as np
from rapidfuzz import fuzz
from scipy.optimize import linear_sum_assignment
from sqlmodel import Session, select

from models import (
    DbSourcePatent, DbSourceInventor,
    UnifiedPatent, UnifiedInventor,
    PatentCrossRef, ReconciliationChoice,
)
from services.import_service import parse_date


def score_title(a: str, b: str) -> float:
    """Case-insensitive fuzzy ratio, 0.0–1.0."""
    return fuzz.ratio(a.lower().strip(), b.lower().strip()) / 100.0


def score_inventor_lists(db_names: list[str], uni_names: list[str]) -> float:
    """Match inventors using token_sort_ratio. Returns average best-match score."""
    if not db_names and not uni_names:
        return 1.0
    if not db_names or not uni_names:
        return 0.0
    scores = []
    for dn in db_names:
        best = max(fuzz.token_sort_ratio(dn.lower(), un.lower()) for un in uni_names)
        scores.append(best / 100.0)
    for un in uni_names:
        best = max(fuzz.token_sort_ratio(un.lower(), dn.lower()) for dn in db_names)
        scores.append(best / 100.0)
    return sum(scores) / len(scores)


def _db_inventor_dict(db_inv: DbSourceInventor, uni_inv=None, score: float = 0.0) -> dict:
    """Build an alignment entry for a db inventor."""
    return {
        "db_inventor_id": db_inv.id,
        "db_inventor_name": db_inv.legal_name,
        "db_inventor_award_type": db_inv.award_type,
        "db_inventor_country": db_inv.work_country_iso,
        "db_inventor_employee_id": db_inv.employee_id,
        "db_inventor_work_state": db_inv.work_state,
        "db_inventor_employment_status": db_inv.employment_status,
        "unified_inventor_id": uni_inv.id if uni_inv else None,
        "unified_inventor_name": uni_inv.raw_name if uni_inv else None,
        "score": round(score, 3),
    }


def align_inventors(
    db_inventors: list[DbSourceInventor],
    uni_inventors: list[UnifiedInventor],
) -> list[dict]:
    """Optimal alignment of inventor lists using the Hungarian algorithm."""
    if not db_inventors and not uni_inventors:
        return []

    if not db_inventors:
        return [{
            "db_inventor_id": None,
            "db_inventor_name": None,
            "db_inventor_award_type": None,
            "db_inventor_country": None,
            "db_inventor_employee_id": None,
            "db_inventor_work_state": None,
            "db_inventor_employment_status": None,
            "unified_inventor_id": ui.id,
            "unified_inventor_name": ui.raw_name,
            "score": 0.0,
        } for ui in uni_inventors]

    if not uni_inventors:
        return [_db_inventor_dict(db_inv) for db_inv in db_inventors]

    # Build score matrix
    n_db = len(db_inventors)
    n_uni = len(uni_inventors)
    score_matrix = np.zeros((n_db, n_uni))
    for i, db_inv in enumerate(db_inventors):
        for j, ui in enumerate(uni_inventors):
            score_matrix[i, j] = fuzz.token_sort_ratio(
                db_inv.legal_name.lower(), ui.raw_name.lower()
            ) / 100.0

    # Hungarian algorithm (minimizes cost, so negate scores)
    row_ind, col_ind = linear_sum_assignment(-score_matrix)

    alignment = []
    matched_db = set()
    matched_uni = set()

    for r, c in zip(row_ind, col_ind):
        score = score_matrix[r, c]
        if score > 0.3:
            alignment.append(_db_inventor_dict(db_inventors[r], uni_inventors[c], score))
            matched_db.add(r)
            matched_uni.add(c)
        else:
            # Score too low — treat as unmatched
            alignment.append(_db_inventor_dict(db_inventors[r]))
            matched_db.add(r)

    # Unmatched db inventors
    for i, db_inv in enumerate(db_inventors):
        if i not in matched_db:
            alignment.append(_db_inventor_dict(db_inv))

    # Unmatched unified inventors
    for j, ui in enumerate(uni_inventors):
        if j not in matched_uni:
            alignment.append({
                "db_inventor_id": None,
                "db_inventor_name": None,
                "db_inventor_award_type": None,
                "db_inventor_country": None,
                "db_inventor_employee_id": None,
                "db_inventor_work_state": None,
                "db_inventor_employment_status": None,
                "unified_inventor_id": ui.id,
                "unified_inventor_name": ui.raw_name,
                "score": 0.0,
            })

    return alignment


def run_matching(session: Session, project_id: int) -> dict:
    """Run cross-reference matching for a project. Returns summary stats."""
    # Clear existing crossrefs
    existing = session.exec(
        select(PatentCrossRef).where(PatentCrossRef.project_id == project_id)
    ).all()
    for cr in existing:
        choices = session.exec(
            select(ReconciliationChoice).where(ReconciliationChoice.crossref_id == cr.id)
        ).all()
        for ch in choices:
            session.delete(ch)
        session.delete(cr)
    session.flush()

    # Load all patents
    db_patents = session.exec(
        select(DbSourcePatent).where(DbSourcePatent.project_id == project_id)
    ).all()
    uni_patents = session.exec(
        select(UnifiedPatent).where(UnifiedPatent.project_id == project_id)
    ).all()

    # Build lookup by normalized number
    db_by_num: dict[str, DbSourcePatent] = {}
    for p in db_patents:
        db_by_num[p.patent_no_numeric] = p

    uni_by_num: dict[str, UnifiedPatent] = {}
    for p in uni_patents:
        uni_by_num[p.patent_no_numeric] = p

    all_keys = set(db_by_num.keys()) | set(uni_by_num.keys())
    stats = {"total": 0, "passed": 0, "flagged": 0}

    for key in all_keys:
        db_pat = db_by_num.get(key)
        uni_pat = uni_by_num.get(key)

        if db_pat and uni_pat:
            # Both exist — compute scores
            db_inventors = session.exec(
                select(DbSourceInventor).where(DbSourceInventor.db_source_patent_id == db_pat.id)
            ).all()
            uni_inventors = session.exec(
                select(UnifiedInventor).where(UnifiedInventor.unified_patent_id == uni_pat.id)
            ).all()

            t_score = score_title(db_pat.title, uni_pat.title)
            d_match = db_pat.issue_date == uni_pat.publication_date
            db_names = [inv.legal_name for inv in db_inventors]
            uni_names = [inv.raw_name for inv in uni_inventors]
            i_score = score_inventor_lists(db_names, uni_names)
            inv_count_db = len(db_inventors)
            inv_count_uni = len(uni_inventors)

            match_score = t_score * 0.3 + (1.0 if d_match else 0.0) * 0.2 + i_score * 0.5

            notes_parts = []
            if t_score < 1.0:
                db_title = db_pat.title.strip()
                uni_title = uni_pat.title.strip()
                if db_title.lower() == uni_title.lower():
                    notes_parts.append(f"Title case mismatch — DB: \"{db_title}\" vs Unified: \"{uni_title}\"")
                else:
                    notes_parts.append(f"Title mismatch (score {t_score:.2f}) — DB: \"{db_title}\" vs Unified: \"{uni_title}\"")
            if not d_match:
                notes_parts.append("Date mismatch")
            if inv_count_db != inv_count_uni:
                notes_parts.append(f"Inventor count differs ({inv_count_db} vs {inv_count_uni})")
            if i_score < 1.0:
                notes_parts.append(f"Inventor name mismatch (score {i_score:.2f})")

            auto_pass = match_score >= 1.0 and d_match and inv_count_db == inv_count_uni
            status = "Passed Auto Review" if auto_pass else "Flagged"

            crossref = PatentCrossRef(
                project_id=project_id,
                db_source_patent_id=db_pat.id,
                unified_patent_id=uni_pat.id,
                status=status,
                match_score=round(match_score, 3),
                title_score=round(t_score, 3),
                date_match=d_match,
                inventor_score=round(i_score, 3),
                inventor_count_db=inv_count_db,
                inventor_count_unified=inv_count_uni,
                notes="; ".join(notes_parts) if notes_parts else None,
            )
        elif db_pat:
            crossref = PatentCrossRef(
                project_id=project_id,
                db_source_patent_id=db_pat.id,
                unified_patent_id=None,
                status="Flagged",
                notes="No matching unified record",
            )
        else:
            crossref = PatentCrossRef(
                project_id=project_id,
                db_source_patent_id=None,
                unified_patent_id=uni_pat.id,
                status="Flagged",
                notes="No matching db_source record",
            )

        session.add(crossref)
        stats["total"] += 1
        if crossref.status == "Flagged":
            stats["flagged"] += 1
        else:
            stats["passed"] += 1

    session.commit()
    return stats
