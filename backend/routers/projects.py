from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from models import Project, PatentCrossRef
from database import get_session

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("")
def list_projects(session: Session = Depends(get_session)):
    projects = session.exec(select(Project).order_by(Project.created_at.desc())).all()
    results = []
    for p in projects:
        crossrefs = session.exec(
            select(PatentCrossRef).where(PatentCrossRef.project_id == p.id)
        ).all()
        total = len(crossrefs)
        flagged = sum(1 for c in crossrefs if c.status == "Flagged")
        passed = sum(1 for c in crossrefs if c.status == "Passed Auto Review")
        resolved = sum(1 for c in crossrefs if c.resolved)
        results.append({
            **p.model_dump(),
            "total": total,
            "flagged": flagged,
            "passed": passed,
            "resolved": resolved,
        })
    return results


@router.post("")
def create_project(data: dict, session: Session = Depends(get_session)):
    project = Project(name=data["name"])
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.get("/{project_id}")
def get_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Project not found")
    crossrefs = session.exec(
        select(PatentCrossRef).where(PatentCrossRef.project_id == project_id)
    ).all()
    return {
        **project.model_dump(),
        "total": len(crossrefs),
        "flagged": sum(1 for c in crossrefs if c.status == "Flagged"),
        "passed": sum(1 for c in crossrefs if c.status == "Passed Auto Review"),
        "resolved": sum(1 for c in crossrefs if c.resolved),
    }


@router.delete("/{project_id}")
def delete_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Project not found")
    # Cascade delete all related records
    from models import (
        DbSourcePatent, DbSourceInventor, UnifiedPatent, UnifiedInventor,
        ReconciliationChoice, InventorAttendance, PhysicalAward,
        AwardCost, TaxRate, ProgramMgmtFee, ShippingAddress, InventorShipping,
    )

    crossrefs = session.exec(select(PatentCrossRef).where(PatentCrossRef.project_id == project_id)).all()
    for cr in crossrefs:
        choices = session.exec(select(ReconciliationChoice).where(ReconciliationChoice.crossref_id == cr.id)).all()
        for ch in choices:
            session.delete(ch)
        session.delete(cr)

    db_patents = session.exec(select(DbSourcePatent).where(DbSourcePatent.project_id == project_id)).all()
    for dp in db_patents:
        inventors = session.exec(select(DbSourceInventor).where(DbSourceInventor.db_source_patent_id == dp.id)).all()
        for inv in inventors:
            session.delete(inv)
        session.delete(dp)

    uni_patents = session.exec(select(UnifiedPatent).where(UnifiedPatent.project_id == project_id)).all()
    for up in uni_patents:
        inventors = session.exec(select(UnifiedInventor).where(UnifiedInventor.unified_patent_id == up.id)).all()
        for inv in inventors:
            session.delete(inv)
        session.delete(up)

    # Delete new table data
    for model in [InventorAttendance, PhysicalAward, AwardCost, TaxRate, ProgramMgmtFee, ShippingAddress, InventorShipping]:
        rows = session.exec(select(model).where(model.project_id == project_id)).all()
        for row in rows:
            session.delete(row)

    session.delete(project)
    session.commit()
    return {"ok": True}
