import csv
import re
from datetime import date, datetime
from typing import Optional

import openpyxl
from sqlmodel import Session, select

from models import (
    DbSourcePatent, DbSourceInventor,
    UnifiedPatent, UnifiedInventor,
    PatentCrossRef, ReconciliationChoice,
)


def normalize_patent_number(raw: str) -> str:
    """Extract numeric patent identifier, keeping D prefix for design patents."""
    cleaned = raw.strip().upper().replace(" ", "")
    # Remove US prefix (with or without hyphen)
    cleaned = re.sub(r"^US-?", "", cleaned)
    # Remove suffix like -B2, -S1, -A1
    cleaned = re.sub(r"-[A-Z]\d*$", "", cleaned)
    return cleaned


def normalize_name(name: str) -> str:
    """Lowercase, split tokens, sort alphabetically."""
    return " ".join(sorted(name.strip().lower().split()))


def parse_date(val) -> Optional[date]:
    """Parse various date formats to date object."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    s = str(val).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%m/%d/%y", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def clear_db_source(session: Session, project_id: int):
    """Delete existing db_source data for a project."""
    patents = session.exec(
        select(DbSourcePatent).where(DbSourcePatent.project_id == project_id)
    ).all()
    for p in patents:
        inventors = session.exec(
            select(DbSourceInventor).where(DbSourceInventor.db_source_patent_id == p.id)
        ).all()
        for inv in inventors:
            session.delete(inv)
        session.delete(p)
    # Also clear crossrefs since data changed
    _clear_crossrefs(session, project_id)
    session.commit()


def clear_unified(session: Session, project_id: int):
    """Delete existing unified data for a project."""
    patents = session.exec(
        select(UnifiedPatent).where(UnifiedPatent.project_id == project_id)
    ).all()
    for p in patents:
        inventors = session.exec(
            select(UnifiedInventor).where(UnifiedInventor.unified_patent_id == p.id)
        ).all()
        for inv in inventors:
            session.delete(inv)
        session.delete(p)
    _clear_crossrefs(session, project_id)
    session.commit()


def _clear_crossrefs(session: Session, project_id: int):
    crossrefs = session.exec(
        select(PatentCrossRef).where(PatentCrossRef.project_id == project_id)
    ).all()
    for cr in crossrefs:
        choices = session.exec(
            select(ReconciliationChoice).where(ReconciliationChoice.crossref_id == cr.id)
        ).all()
        for ch in choices:
            session.delete(ch)
        session.delete(cr)


def import_db_source(session: Session, project_id: int, file_path: str) -> dict:
    """Import db_source CSV. Groups rows by Patent No. to create one patent with multiple inventors."""
    clear_db_source(session, project_id)

    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # Group by Patent No.
    groups: dict[str, list[dict]] = {}
    for row in rows:
        key = row["Patent No."].strip()
        groups.setdefault(key, []).append(row)

    patent_count = 0
    inventor_count = 0

    for patent_no, group_rows in groups.items():
        first = group_rows[0]
        patent = DbSourcePatent(
            project_id=project_id,
            asset_name=first["Patent: Asset Name"].strip(),
            patent_no=patent_no,
            patent_no_numeric=normalize_patent_number(patent_no),
            title=first["Title"].strip(),
            issue_date=parse_date(first["Issue Date of Patent"]),
        )
        session.add(patent)
        session.flush()  # get patent.id
        patent_count += 1

        for row in group_rows:
            name = row["Inventor: Legal Name"].strip()
            inventor = DbSourceInventor(
                db_source_patent_id=patent.id,
                legal_name=name,
                name_normalized=normalize_name(name),
                office_location_country=row.get("Inventor: Office Location Country", "").strip() or None,
                work_country_iso=row.get("Inventor: Work Country ISO code", "").strip() or None,
                address=row.get("Inventor: Address", "").strip() or None,
                award_type=row.get("Inventor: Award Type", "").strip() or None,
            )
            session.add(inventor)
            inventor_count += 1

    session.commit()
    return {"patents_imported": patent_count, "inventors_imported": inventor_count}


def import_unified(session: Session, project_id: int, file_path: str) -> dict:
    """Import unified XLSX. Splits pipe-delimited inventors into separate rows."""
    clear_unified(session, project_id)

    wb = openpyxl.load_workbook(file_path)
    ws = wb.active

    # Read header row
    headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]

    patent_count = 0
    inventor_count = 0

    for row in ws.iter_rows(min_row=2, values_only=True):
        data = dict(zip(headers, row))
        pub_number = str(data.get("publication_number", "")).strip()
        if not pub_number:
            continue

        patent = UnifiedPatent(
            project_id=project_id,
            publication_number=pub_number,
            patent_no_numeric=normalize_patent_number(pub_number),
            publication_date=parse_date(data.get("publication_date")),
            title=str(data.get("title", "")).strip(),
            grant_number=str(data.get("grant_number", "")).strip(),
            assignee_current=str(data.get("assignee_current", "")).strip() or None,
            assignee_original=str(data.get("assignee_original", "")).strip() or None,
            assignee_parent=str(data.get("assignee_parent", "")).strip() or None,
            application_date=parse_date(data.get("application_date")),
            priority_date=parse_date(data.get("priority_date")),
            publication_status=str(data.get("publication_status", "")).strip() or None,
            publication_type=str(data.get("publication_type", "")).strip() or None,
            country=str(data.get("country", "")).strip() or None,
        )
        session.add(patent)
        session.flush()
        patent_count += 1

        # Split inventors by pipe
        inventors_raw = str(data.get("inventors", "")).strip()
        if inventors_raw:
            for name in inventors_raw.split("|"):
                name = name.strip()
                if name:
                    inv = UnifiedInventor(
                        unified_patent_id=patent.id,
                        raw_name=name,
                        name_normalized=normalize_name(name),
                    )
                    session.add(inv)
                    inventor_count += 1

    session.commit()
    return {"patents_imported": patent_count, "inventors_imported": inventor_count}
