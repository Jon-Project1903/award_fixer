from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models import PhysicalAward
from services.award_service import generate_physical_awards, compute_cost_summary

router = APIRouter(prefix="/api/projects", tags=["awards"])


@router.post("/{project_id}/generate-awards")
def generate_awards(project_id: int, session: Session = Depends(get_session)):
    return generate_physical_awards(session, project_id)


@router.get("/{project_id}/physical-awards")
def list_physical_awards(project_id: int, session: Session = Depends(get_session)):
    return session.exec(
        select(PhysicalAward).where(PhysicalAward.project_id == project_id)
    ).all()


@router.post("/{project_id}/physical-awards")
def create_physical_award(project_id: int, data: dict, session: Session = Depends(get_session)):
    award = PhysicalAward(
        project_id=project_id,
        employee_id=data["employee_id"],
        patent_number=data["patent_number"],
        award_type=data["award_type"],
        inventor_name=data.get("inventor_name", ""),
        work_state=data.get("work_state"),
    )
    session.add(award)
    session.commit()
    session.refresh(award)
    return award


@router.put("/{project_id}/physical-awards/{award_id}")
def update_physical_award(
    project_id: int, award_id: int, data: dict,
    session: Session = Depends(get_session),
):
    award = session.get(PhysicalAward, award_id)
    if not award or award.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    for field in ("employee_id", "patent_number", "award_type", "inventor_name", "work_state"):
        if field in data:
            setattr(award, field, data[field])
    session.add(award)
    session.commit()
    session.refresh(award)
    return award


@router.delete("/{project_id}/physical-awards/{award_id}")
def delete_physical_award(
    project_id: int, award_id: int,
    session: Session = Depends(get_session),
):
    award = session.get(PhysicalAward, award_id)
    if not award or award.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(award)
    session.commit()
    return {"ok": True}


@router.get("/{project_id}/cost-summary")
def get_cost_summary(project_id: int, session: Session = Depends(get_session)):
    return compute_cost_summary(session, project_id)
