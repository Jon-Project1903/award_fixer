import logging
import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlmodel import Session
from database import get_session
from models import Project
from services.import_service import import_db_source, import_unified

logger = logging.getLogger(__name__)

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

    logger.info("Saved db_source upload to %s (%d bytes)", file_path, os.path.getsize(file_path))

    try:
        result = import_db_source(session, project_id, file_path)
    except Exception as e:
        logger.exception("Failed to import db_source CSV for project %d", project_id)
        raise HTTPException(status_code=422, detail=f"CSV import failed: {e}")
    logger.info("db_source import result for project %d: %s", project_id, result)
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

    logger.info("Saved unified upload to %s (%d bytes)", file_path, os.path.getsize(file_path))

    try:
        result = import_unified(session, project_id, file_path)
    except Exception as e:
        logger.exception("Failed to import unified XLSX for project %d", project_id)
        raise HTTPException(status_code=422, detail=f"XLSX import failed: {e}")
    logger.info("unified import result for project %d: %s", project_id, result)
    return result
