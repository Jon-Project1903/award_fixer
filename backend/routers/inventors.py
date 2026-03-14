from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from collections import defaultdict

from database import get_session
from models import DbSourcePatent, DbSourceInventor, PatentCrossRef

router = APIRouter(prefix="/api/projects", tags=["inventors"])


@router.get("/{project_id}/inventors")
def list_inventors(project_id: int, session: Session = Depends(get_session)):
    """List all unique inventors across the project, aggregated by employee_id or name."""
    # Get all crossrefs with db_source data
    crossrefs = session.exec(
        select(PatentCrossRef).where(
            PatentCrossRef.project_id == project_id,
            PatentCrossRef.db_source_patent_id != None,
        )
    ).all()

    # Collect all inventors with their patent info
    inventor_map: dict[str, dict] = {}  # keyed by dedup key
    for cr in crossrefs:
        db_pat = session.get(DbSourcePatent, cr.db_source_patent_id)
        if not db_pat:
            continue

        inventors = session.exec(
            select(DbSourceInventor).where(
                DbSourceInventor.db_source_patent_id == db_pat.id
            )
        ).all()

        for inv in inventors:
            emp_id = (inv.employee_id or "").strip()
            dedup_key = emp_id if emp_id else inv.legal_name.strip().lower()

            if dedup_key not in inventor_map:
                inventor_map[dedup_key] = {
                    "employee_id": inv.employee_id,
                    "legal_name": inv.legal_name,
                    "preferred_name": inv.preferred_name,
                    "work_email": inv.work_email,
                    "work_state": inv.work_state,
                    "work_city": inv.work_city,
                    "work_country_iso": inv.work_country_iso,
                    "office_location_country": inv.office_location_country,
                    "address": inv.address,
                    "employment_status": inv.employment_status,
                    "patents": [],
                }

            inventor_map[dedup_key]["patents"].append({
                "patent_no": db_pat.patent_no,
                "asset_name": db_pat.asset_name,
                "title": db_pat.title,
                "issue_date": db_pat.issue_date.isoformat() if db_pat.issue_date else None,
                "award_type": inv.award_type,
                "crossref_id": cr.id,
            })

    # Build result list sorted by name
    results = []
    for key, data in inventor_map.items():
        award_types = list({p["award_type"] for p in data["patents"] if p["award_type"]})
        results.append({
            **data,
            "patent_count": len(data["patents"]),
            "award_types": award_types,
        })

    results.sort(key=lambda r: (r["legal_name"] or "").lower())
    return results
