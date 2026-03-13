import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlmodel import Session
from database import get_session
from models import Project
from services.import_service import import_db_source, import_unified

router = APIRouter(prefix="/api/projects", tags=["imports"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/{project_id}/import/db-source")
async def upload_db_source(
    project_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    file_path = os.path.join(UPLOAD_DIR, f"db_source_{project_id}.csv")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    result = import_db_source(session, project_id, file_path)
    return result


@router.post("/{project_id}/import/unified")
async def upload_unified(
    project_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    file_path = os.path.join(UPLOAD_DIR, f"unified_{project_id}.xlsx")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    result = import_unified(session, project_id, file_path)
    return result
