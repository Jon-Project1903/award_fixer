import csv
import io
import re
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from database import get_session
from models import (
    Project, PatentCrossRef, DbSourcePatent, DbSourceInventor,
    UnifiedPatent, UnifiedInventor, ReconciliationChoice,
)

router = APIRouter(prefix="/api/projects", tags=["export"])


@router.get("/{project_id}/export")
def export_csv(project_id: int, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    crossrefs = session.exec(
        select(PatentCrossRef).where(PatentCrossRef.project_id == project_id)
    ).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Patent No.", "Asset Name", "Title", "Issue Date",
        "Inventor Name", "Country", "Award Type",
        "Status", "Resolved",
    ])

    for cr in crossrefs:
        # Load choices as a dict
        choices = session.exec(
            select(ReconciliationChoice).where(ReconciliationChoice.crossref_id == cr.id)
        ).all()
        choice_map = {c.field_name: c.chosen_value for c in choices}

        db_pat = session.get(DbSourcePatent, cr.db_source_patent_id) if cr.db_source_patent_id else None
        uni_pat = session.get(UnifiedPatent, cr.unified_patent_id) if cr.unified_patent_id else None

        # Use resolved values from choices (these are the final output values)
        patent_no = choice_map.get("patent_no", db_pat.patent_no if db_pat else (uni_pat.publication_number if uni_pat else ""))
        asset_name = db_pat.asset_name if db_pat else ""
        title = choice_map.get("title", db_pat.title if db_pat else (uni_pat.title if uni_pat else ""))
        issue_date = choice_map.get("issue_date", str(db_pat.issue_date) if db_pat else (str(uni_pat.publication_date) if uni_pat else ""))

        wrote_any = False

        # DB source inventors
        if db_pat:
            db_inventors = session.exec(
                select(DbSourceInventor).where(DbSourceInventor.db_source_patent_id == db_pat.id)
            ).all()
            for inv in db_inventors:
                include_key = f"inventor_{inv.id}_include"
                if choice_map.get(include_key) == "no":
                    continue
                # Skip Opt-Out
                award = inv.award_type or ""
                if award.lower() == "opt-out":
                    continue
                inv_name = choice_map.get(f"inventor_{inv.id}_name", inv.legal_name)
                writer.writerow([
                    patent_no, asset_name, title, issue_date,
                    inv_name, inv.work_country_iso or "", award,
                    cr.status, "Yes" if cr.resolved else "No",
                ])
                wrote_any = True

        # Unified-only inventors
        if uni_pat:
            uni_inventors = session.exec(
                select(UnifiedInventor).where(UnifiedInventor.unified_patent_id == uni_pat.id)
            ).all()
            for inv in uni_inventors:
                include_key = f"inventor_uni_{inv.id}_include"
                if choice_map.get(include_key) == "no":
                    continue
                # For unified inventors that overlap with db_source (already written), skip
                # They are only written if there's no db_source patent
                if db_pat:
                    continue
                inv_name = choice_map.get(f"inventor_uni_{inv.id}_name", inv.raw_name)
                writer.writerow([
                    patent_no, asset_name, title, issue_date,
                    inv_name, "", "",
                    cr.status, "Yes" if cr.resolved else "No",
                ])
                wrote_any = True

        # Manually added inventors
        new_inventor_keys = sorted(
            [k for k in choice_map if re.match(r"inventor_new_\d+_name", k)],
            key=lambda k: int(re.search(r"\d+", k.replace("inventor_new_", "")).group())
        )
        for name_key in new_inventor_keys:
            idx = re.search(r"inventor_new_(\d+)_name", name_key).group(1)
            include_key = f"inventor_new_{idx}_include"
            if choice_map.get(include_key) == "no":
                continue
            inv_name = choice_map.get(name_key, "")
            if inv_name:
                writer.writerow([
                    patent_no, asset_name, title, issue_date,
                    inv_name, "", "",
                    cr.status, "Yes" if cr.resolved else "No",
                ])
                wrote_any = True

        # If no inventors written at all, still write the patent row
        if not wrote_any:
            writer.writerow([
                patent_no, asset_name, title, issue_date,
                "", "", "",
                cr.status, "Yes" if cr.resolved else "No",
            ])

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{project.name}_export.csv"'},
    )
