import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select

from database import get_session
from models import InventorAttendance, PatentCrossRef, DbSourcePatent, DbSourceInventor
from services.import_service import import_attendance

router = APIRouter(prefix="/api/projects", tags=["attendance"])


@router.post("/{project_id}/import/attendance")
async def upload_attendance(
    project_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    os.makedirs("uploads", exist_ok=True)
    path = f"uploads/attendance_{project_id}.csv"
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)
    result = import_attendance(session, project_id, path)
    return result


@router.get("/{project_id}/attendance")
def list_attendance(project_id: int, session: Session = Depends(get_session)):
    return session.exec(
        select(InventorAttendance).where(InventorAttendance.project_id == project_id)
    ).all()


@router.post("/{project_id}/attendance/populate-from-inventors")
def populate_from_inventors(project_id: int, session: Session = Depends(get_session)):
    """Add all inventors from reconciled data into attendance table (skipping duplicates)."""
    # Get existing employee_ids already in attendance
    existing = session.exec(
        select(InventorAttendance).where(InventorAttendance.project_id == project_id)
    ).all()
    existing_emp_ids = set()
    for a in existing:
        existing_emp_ids.add(a.employee_id)
        existing_emp_ids.add(a.employee_id.strip().lower())

    # Get all crossrefs with db_source data
    crossrefs = session.exec(
        select(PatentCrossRef).where(
            PatentCrossRef.project_id == project_id,
            PatentCrossRef.db_source_patent_id != None,
        )
    ).all()

    added = 0
    seen_keys: set[str] = set()
    for cr in crossrefs:
        inventors = session.exec(
            select(DbSourceInventor).where(
                DbSourceInventor.db_source_patent_id == cr.db_source_patent_id
            )
        ).all()
        for inv in inventors:
            # Use employee_id if available, otherwise fall back to name as dedup key
            emp_id = (inv.employee_id or "").strip()
            dedup_key = emp_id if emp_id else inv.legal_name.strip().lower()
            if dedup_key in existing_emp_ids or dedup_key in seen_keys:
                continue
            seen_keys.add(dedup_key)
            session.add(InventorAttendance(
                project_id=project_id,
                employee_id=emp_id or inv.legal_name,
                email=inv.work_email or "",
                attendance_status="Unknown",
            ))
            added += 1

    session.commit()
    total = len(session.exec(
        select(InventorAttendance).where(InventorAttendance.project_id == project_id)
    ).all())
    return {"added": added, "total": total}


@router.put("/{project_id}/attendance/{attendance_id}")
def update_attendance(
    project_id: int,
    attendance_id: int,
    data: dict,
    session: Session = Depends(get_session),
):
    att = session.get(InventorAttendance, attendance_id)
    if not att or att.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    if "attendance_status" in data:
        att.attendance_status = data["attendance_status"]
    session.add(att)
    session.commit()
    session.refresh(att)

    # Recompute shipping after attendance change
    from routers.shipping import recompute_shipping
    recompute_shipping(session, project_id)

    return att
