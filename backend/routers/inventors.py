from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from collections import defaultdict

from database import get_session
from models import DbSourcePatent, DbSourceInventor, PatentCrossRef, PhysicalAward, OptOutAward, TermedAward, TaxRate

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


@router.put("/{project_id}/inventors/award-type")
def update_inventor_award_type(project_id: int, data: dict, session: Session = Depends(get_session)):
    """Update award_type for all DbSourceInventor records matching an inventor, and sync to PhysicalAward."""
    inventor_key = data.get("inventor_key", "").strip()
    new_award_type = data.get("award_type", "").strip()
    if not inventor_key or not new_award_type:
        raise HTTPException(status_code=400, detail="inventor_key and award_type required")

    # Find all crossrefs for this project
    crossrefs = session.exec(
        select(PatentCrossRef).where(
            PatentCrossRef.project_id == project_id,
            PatentCrossRef.db_source_patent_id != None,
        )
    ).all()

    updated = 0
    for cr in crossrefs:
        inventors = session.exec(
            select(DbSourceInventor).where(
                DbSourceInventor.db_source_patent_id == cr.db_source_patent_id
            )
        ).all()
        for inv in inventors:
            emp_id = (inv.employee_id or "").strip()
            dedup_key = emp_id if emp_id else inv.legal_name.strip().lower()
            if dedup_key == inventor_key:
                inv.award_type = new_award_type
                session.add(inv)
                updated += 1

    # Also update PhysicalAward records for this inventor
    awards = session.exec(
        select(PhysicalAward).where(PhysicalAward.project_id == project_id)
    ).all()
    awards_updated = 0
    for a in awards:
        emp_key = (a.employee_id or "").strip()
        if emp_key == inventor_key or a.inventor_name.strip().lower() == inventor_key:
            a.award_type = new_award_type
            session.add(a)
            awards_updated += 1

    session.commit()
    return {"ok": True, "inventors_updated": updated, "awards_updated": awards_updated}


@router.put("/{project_id}/inventors/city")
def update_inventor_city(project_id: int, data: dict, session: Session = Depends(get_session)):
    """Update work_city for all records matching an inventor, create tax jurisdiction if needed."""
    inventor_key = data.get("inventor_key", "").strip()
    new_city = data.get("city", "").strip()
    new_state = data.get("state")  # optional
    if not inventor_key or not new_city:
        raise HTTPException(status_code=400, detail="inventor_key and city required")

    # Update DbSourceInventor records
    crossrefs = session.exec(
        select(PatentCrossRef).where(
            PatentCrossRef.project_id == project_id,
            PatentCrossRef.db_source_patent_id != None,
        )
    ).all()

    updated = 0
    for cr in crossrefs:
        inventors = session.exec(
            select(DbSourceInventor).where(
                DbSourceInventor.db_source_patent_id == cr.db_source_patent_id
            )
        ).all()
        for inv in inventors:
            emp_id = (inv.employee_id or "").strip()
            dedup_key = emp_id if emp_id else inv.legal_name.strip().lower()
            if dedup_key == inventor_key:
                inv.work_city = new_city
                if new_state is not None:
                    inv.work_state = new_state
                session.add(inv)
                updated += 1

    # Update PhysicalAward, OptOutAward, TermedAward records
    awards_updated = 0
    for model in (PhysicalAward, OptOutAward, TermedAward):
        awards = session.exec(
            select(model).where(model.project_id == project_id)
        ).all()
        for a in awards:
            emp_key = (a.employee_id or "").strip()
            if emp_key == inventor_key or a.inventor_name.strip().lower() == inventor_key:
                a.work_city = new_city
                if new_state is not None:
                    a.work_state = new_state
                session.add(a)
                awards_updated += 1

    # Check if tax jurisdiction exists for this city, create if not
    tax_created = False
    existing_tax = session.exec(
        select(TaxRate).where(
            TaxRate.project_id == project_id,
            TaxRate.lookup_key == new_city,
        )
    ).first()
    if not existing_tax:
        tax_rate = TaxRate(
            project_id=project_id,
            jurisdiction=new_city,
            state=new_state,
            lookup_key=new_city,
            tax_percent=0.0,
        )
        session.add(tax_rate)
        tax_created = True

    session.commit()
    return {
        "ok": True,
        "inventors_updated": updated,
        "awards_updated": awards_updated,
        "tax_jurisdiction_created": tax_created,
    }
