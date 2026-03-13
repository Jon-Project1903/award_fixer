from rapidfuzz import fuzz
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


def align_inventors(
    db_inventors: list[DbSourceInventor],
    uni_inventors: list[UnifiedInventor],
) -> list[dict]:
    """Greedy best-match alignment of inventor lists."""
    alignment = []
    used_uni = set()

    for db_inv in db_inventors:
        best_score = 0.0
        best_uni = None
        for ui in uni_inventors:
            if ui.id in used_uni:
                continue
            score = fuzz.token_sort_ratio(db_inv.legal_name.lower(), ui.raw_name.lower()) / 100.0
            if score > best_score:
                best_score = score
                best_uni = ui
        if best_uni and best_score > 0.3:
            used_uni.add(best_uni.id)
            alignment.append({
                "db_inventor_id": db_inv.id,
                "db_inventor_name": db_inv.legal_name,
                "db_inventor_award_type": db_inv.award_type,
                "db_inventor_country": db_inv.work_country_iso,
                "unified_inventor_id": best_uni.id,
                "unified_inventor_name": best_uni.raw_name,
                "score": round(best_score, 3),
            })
        else:
            alignment.append({
                "db_inventor_id": db_inv.id,
                "db_inventor_name": db_inv.legal_name,
                "db_inventor_award_type": db_inv.award_type,
                "db_inventor_country": db_inv.work_country_iso,
                "unified_inventor_id": None,
                "unified_inventor_name": None,
                "score": 0.0,
            })

    # Unmatched unified inventors
    for ui in uni_inventors:
        if ui.id not in used_uni:
            alignment.append({
                "db_inventor_id": None,
                "db_inventor_name": None,
                "db_inventor_award_type": None,
                "db_inventor_country": None,
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
            if t_score < 0.95:
                notes_parts.append(f"Title mismatch (score {t_score:.2f})")
            if not d_match:
                notes_parts.append("Date mismatch")
            if inv_count_db != inv_count_uni:
                notes_parts.append(f"Inventor count differs ({inv_count_db} vs {inv_count_uni})")
            if i_score < 0.85:
                notes_parts.append(f"Inventor name mismatch (score {i_score:.2f})")

            auto_pass = match_score >= 0.85 and d_match and inv_count_db == inv_count_uni
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
