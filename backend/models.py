from datetime import date, datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DbSourcePatent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    asset_name: str
    patent_no: str
    patent_no_numeric: str
    title: str
    issue_date: date


class DbSourceInventor(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    db_source_patent_id: int = Field(foreign_key="dbsourcepatent.id")
    legal_name: str
    name_normalized: str
    office_location_country: Optional[str] = None
    work_country_iso: Optional[str] = None
    address: Optional[str] = None
    award_type: Optional[str] = None


class UnifiedPatent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    publication_number: str
    patent_no_numeric: str
    publication_date: date
    title: str
    grant_number: str
    assignee_current: Optional[str] = None
    assignee_original: Optional[str] = None
    assignee_parent: Optional[str] = None
    application_date: Optional[date] = None
    priority_date: Optional[date] = None
    publication_status: Optional[str] = None
    publication_type: Optional[str] = None
    country: Optional[str] = None


class UnifiedInventor(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    unified_patent_id: int = Field(foreign_key="unifiedpatent.id")
    raw_name: str
    name_normalized: str


class PatentCrossRef(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    db_source_patent_id: Optional[int] = Field(default=None, foreign_key="dbsourcepatent.id")
    unified_patent_id: Optional[int] = Field(default=None, foreign_key="unifiedpatent.id")
    status: str  # "Passed Auto Review" | "Flagged"
    match_score: Optional[float] = None
    title_score: Optional[float] = None
    date_match: Optional[bool] = None
    inventor_score: Optional[float] = None
    inventor_count_db: Optional[int] = None
    inventor_count_unified: Optional[int] = None
    notes: Optional[str] = None
    resolved: bool = False
    resolved_at: Optional[datetime] = None


class ReconciliationChoice(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    crossref_id: int = Field(foreign_key="patentcrossref.id")
    field_name: str
    chosen_source: str  # "db_source" | "unified" | "manual"
    chosen_value: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
