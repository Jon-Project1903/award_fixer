from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models import (
    PatentCrossRef, DbSourcePatent, DbSourceInventor,
    UnifiedPatent, UnifiedInventor, ReconciliationChoice,
)
from pydantic import BaseModel
from services.matching_service import run_matching, align_inventors, score_title, score_inventor_lists
from services.award_service import sync_awards_from_crossref

router = APIRouter(tags=["reconciliation"])


@router.post("/api/projects/{project_id}/match")
def match_project(project_id: int, session: Session = Depends(get_session)):
    return run_matching(session, project_id)


@router.get("/api/projects/{project_id}/reconciliations")
def list_reconciliations(
    project_id: int,
    status: str = None,
    session: Session = Depends(get_session),
):
    query = select(PatentCrossRef).where(PatentCrossRef.project_id == project_id)
    if status:
        query = query.where(PatentCrossRef.status == status)
        query = query.where(PatentCrossRef.resolved == False)
    crossrefs = session.exec(query.order_by(PatentCrossRef.id)).all()

    results = []
    for cr in crossrefs:
        db_pat = session.get(DbSourcePatent, cr.db_source_patent_id) if cr.db_source_patent_id else None
        uni_pat = session.get(UnifiedPatent, cr.unified_patent_id) if cr.unified_patent_id else None
        results.append({
            "id": cr.id,
            "status": cr.status,
            "resolved": cr.resolved,
            "match_score": cr.match_score,
            "notes": cr.notes,
            "patent_no": db_pat.patent_no if db_pat else (uni_pat.publication_number if uni_pat else ""),
            "title": db_pat.title if db_pat else (uni_pat.title if uni_pat else ""),
            "inventor_count_db": cr.inventor_count_db,
            "inventor_count_unified": cr.inventor_count_unified,
            "title_score": cr.title_score,
            "date_match": cr.date_match,
            "db_source_patent_id": cr.db_source_patent_id,
            "unified_patent_id": cr.unified_patent_id,
        })
    return results


@router.get("/api/reconciliations/{crossref_id}")
def get_reconciliation_detail(crossref_id: int, session: Session = Depends(get_session)):
    cr = session.get(PatentCrossRef, crossref_id)
    if not cr:
        raise HTTPException(status_code=404, detail="Not found")

    db_data = None
    if cr.db_source_patent_id:
        db_pat = session.get(DbSourcePatent, cr.db_source_patent_id)
        db_inventors = session.exec(
            select(DbSourceInventor).where(DbSourceInventor.db_source_patent_id == db_pat.id)
        ).all()
        db_data = {
            "patent_no": db_pat.patent_no,
            "asset_name": db_pat.asset_name,
            "title": db_pat.title,
            "issue_date": db_pat.issue_date.isoformat() if db_pat.issue_date else None,
            "inventors": [
                {
                    "id": inv.id,
                    "legal_name": inv.legal_name,
                    "award_type": inv.award_type,
                    "office_location_country": inv.office_location_country,
                    "work_country_iso": inv.work_country_iso,
                    "address": inv.address,
                    "work_city": inv.work_city,
                    "work_state": inv.work_state,
                    "work_email": inv.work_email,
                    "preferred_name": inv.preferred_name,
                    "employment_status": inv.employment_status,
                    "employee_id": inv.employee_id,
                }
                for inv in db_inventors
            ],
        }

    uni_data = None
    if cr.unified_patent_id:
        uni_pat = session.get(UnifiedPatent, cr.unified_patent_id)
        uni_inventors = session.exec(
            select(UnifiedInventor).where(UnifiedInventor.unified_patent_id == uni_pat.id)
        ).all()
        uni_data = {
            "publication_number": uni_pat.publication_number,
            "title": uni_pat.title,
            "publication_date": uni_pat.publication_date.isoformat() if uni_pat.publication_date else None,
            "grant_number": uni_pat.grant_number,
            "assignee_current": uni_pat.assignee_current,
            "inventors": [
                {"id": inv.id, "raw_name": inv.raw_name}
                for inv in uni_inventors
            ],
        }

    # Compute inventor alignment
    inventor_alignment = []
    if cr.db_source_patent_id and cr.unified_patent_id:
        db_inventors = session.exec(
            select(DbSourceInventor).where(DbSourceInventor.db_source_patent_id == cr.db_source_patent_id)
        ).all()
        uni_inventors = session.exec(
            select(UnifiedInventor).where(UnifiedInventor.unified_patent_id == cr.unified_patent_id)
        ).all()
        inventor_alignment = align_inventors(db_inventors, uni_inventors)
    elif cr.db_source_patent_id:
        db_inventors = session.exec(
            select(DbSourceInventor).where(DbSourceInventor.db_source_patent_id == cr.db_source_patent_id)
        ).all()
        for inv in db_inventors:
            inventor_alignment.append({
                "db_inventor_id": inv.id,
                "db_inventor_name": inv.legal_name,
                "db_inventor_award_type": inv.award_type,
                "db_inventor_country": inv.work_country_iso,
                "unified_inventor_id": None,
                "unified_inventor_name": None,
                "score": 0.0,
            })
    elif cr.unified_patent_id:
        uni_inventors = session.exec(
            select(UnifiedInventor).where(UnifiedInventor.unified_patent_id == cr.unified_patent_id)
        ).all()
        for inv in uni_inventors:
            inventor_alignment.append({
                "db_inventor_id": None,
                "db_inventor_name": None,
                "db_inventor_award_type": None,
                "db_inventor_country": None,
                "unified_inventor_id": inv.id,
                "unified_inventor_name": inv.raw_name,
                "score": 0.0,
            })

    # Get existing choices
    choices = session.exec(
        select(ReconciliationChoice).where(ReconciliationChoice.crossref_id == crossref_id)
    ).all()

    return {
        "id": cr.id,
        "project_id": cr.project_id,
        "status": cr.status,
        "resolved": cr.resolved,
        "match_score": cr.match_score,
        "title_score": cr.title_score,
        "date_match": cr.date_match,
        "inventor_score": cr.inventor_score,
        "notes": cr.notes,
        "db_source": db_data,
        "unified": uni_data,
        "inventor_alignment": inventor_alignment,
        "choices": [c.model_dump() for c in choices],
    }


@router.put("/api/reconciliations/{crossref_id}/choices")
def save_choices(crossref_id: int, choices: list[dict], session: Session = Depends(get_session)):
    cr = session.get(PatentCrossRef, crossref_id)
    if not cr:
        raise HTTPException(status_code=404, detail="Not found")

    # Delete existing choices
    existing = session.exec(
        select(ReconciliationChoice).where(ReconciliationChoice.crossref_id == crossref_id)
    ).all()
    for ch in existing:
        session.delete(ch)
    session.flush()

    # Insert new choices
    for c in choices:
        choice = ReconciliationChoice(
            crossref_id=crossref_id,
            field_name=c["field_name"],
            chosen_source=c["chosen_source"],
            chosen_value=c["chosen_value"],
        )
        session.add(choice)

    session.commit()

    # Sync physical awards if they exist
    sync_result = sync_awards_from_crossref(session, crossref_id)

    return {"ok": True, "count": len(choices), "awards_updated": sync_result["updated"]}


class MergeRequest(BaseModel):
    db_crossref_id: int
    uni_crossref_id: int
    final_patent_no: str


@router.post("/api/projects/{project_id}/merge")
def merge_crossrefs(project_id: int, req: MergeRequest, session: Session = Depends(get_session)):
    """Merge a db-only crossref and a unified-only crossref into a single matched crossref."""
    db_cr = session.get(PatentCrossRef, req.db_crossref_id)
    uni_cr = session.get(PatentCrossRef, req.uni_crossref_id)
    if not db_cr or not uni_cr:
        raise HTTPException(status_code=404, detail="One or both crossrefs not found")
    if db_cr.project_id != project_id or uni_cr.project_id != project_id:
        raise HTTPException(status_code=400, detail="Crossrefs don't belong to this project")
    if not db_cr.db_source_patent_id or db_cr.unified_patent_id:
        raise HTTPException(status_code=400, detail="First crossref must be db-source only")
    if not uni_cr.unified_patent_id or uni_cr.db_source_patent_id:
        raise HTTPException(status_code=400, detail="Second crossref must be unified only")

    db_pat = session.get(DbSourcePatent, db_cr.db_source_patent_id)
    uni_pat = session.get(UnifiedPatent, uni_cr.unified_patent_id)

    # Update the patent_no_numeric on both to match via the user-chosen number
    from services.import_service import normalize_patent_number
    normalized = normalize_patent_number(req.final_patent_no)
    db_pat.patent_no_numeric = normalized
    uni_pat.patent_no_numeric = normalized
    session.add(db_pat)
    session.add(uni_pat)

    # Compute scores for the new pair
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
    notes_parts.append(f"Manually merged (patent no: {req.final_patent_no})")
    if t_score < 1.0:
        db_title = db_pat.title.strip()
        uni_title = uni_pat.title.strip()
        if db_title.lower() == uni_title.lower():
            notes_parts.append(f"Title case mismatch")
        else:
            notes_parts.append(f"Title mismatch (score {t_score:.2f})")
    if not d_match:
        notes_parts.append("Date mismatch")
    if inv_count_db != inv_count_uni:
        notes_parts.append(f"Inventor count differs ({inv_count_db} vs {inv_count_uni})")
    if i_score < 1.0:
        notes_parts.append(f"Inventor name mismatch (score {i_score:.2f})")

    # Delete old choices for both crossrefs
    for cr_id in [db_cr.id, uni_cr.id]:
        old_choices = session.exec(
            select(ReconciliationChoice).where(ReconciliationChoice.crossref_id == cr_id)
        ).all()
        for ch in old_choices:
            session.delete(ch)

    # Delete both old crossrefs
    session.delete(db_cr)
    session.delete(uni_cr)
    session.flush()

    # Create new merged crossref
    new_cr = PatentCrossRef(
        project_id=project_id,
        db_source_patent_id=db_pat.id,
        unified_patent_id=uni_pat.id,
        status="Flagged",
        match_score=round(match_score, 3),
        title_score=round(t_score, 3),
        date_match=d_match,
        inventor_score=round(i_score, 3),
        inventor_count_db=inv_count_db,
        inventor_count_unified=inv_count_uni,
        notes="; ".join(notes_parts),
    )
    session.add(new_cr)
    session.commit()
    session.refresh(new_cr)

    return {"ok": True, "new_crossref_id": new_cr.id}


@router.post("/api/projects/{project_id}/resolve-all-passed")
def resolve_all_passed(project_id: int, session: Session = Depends(get_session)):
    """Mark all 'Passed Auto Review' records as resolved."""
    crossrefs = session.exec(
        select(PatentCrossRef).where(
            PatentCrossRef.project_id == project_id,
            PatentCrossRef.status == "Passed Auto Review",
            PatentCrossRef.resolved == False,
        )
    ).all()
    now = datetime.utcnow()
    count = 0
    for cr in crossrefs:
        cr.resolved = True
        cr.resolved_at = now
        session.add(cr)
        count += 1
    session.commit()
    return {"ok": True, "resolved_count": count}


@router.put("/api/reconciliations/{crossref_id}/resolve")
def resolve_reconciliation(crossref_id: int, session: Session = Depends(get_session)):
    cr = session.get(PatentCrossRef, crossref_id)
    if not cr:
        raise HTTPException(status_code=404, detail="Not found")
    cr.resolved = True
    cr.resolved_at = datetime.utcnow()
    session.add(cr)
    session.commit()
    return {"ok": True}
