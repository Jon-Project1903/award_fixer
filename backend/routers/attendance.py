import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select

from database import get_session
from models import InventorAttendance
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
    return att
