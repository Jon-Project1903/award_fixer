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
    work_city: Optional[str] = None
    work_state: Optional[str] = None
    work_email: Optional[str] = None
    preferred_name: Optional[str] = None
    employment_status: Optional[str] = None
    employee_id: Optional[str] = None


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


class InventorAttendance(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    employee_id: str
    email: str
    attendance_status: str = "Unknown"  # "Unknown" | "In-Person" | "Not Attending"


class PhysicalAward(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    employee_id: str
    patent_number: str
    award_type: str
    inventor_name: str
    work_state: Optional[str] = None
    work_city: Optional[str] = None


class AwardCost(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    award_type: str
    cost: float


class TaxRate(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    jurisdiction: str  # city name
    state: Optional[str] = None
    lookup_key: str  # e.g. state code like "CA"
    tax_percent: float


class ProgramMgmtFee(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    description: str
    quantity: int = 1
    cost: float


class ShippingAddress(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    company: Optional[str] = None
    ship_to: Optional[str] = None
    email: Optional[str] = None
    address_1: Optional[str] = None
    address_2: Optional[str] = None
    address_3: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    taxable: bool = False


class InventorShipping(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    employee_id: str
    inventor_name: str
    work_city: Optional[str] = None
    attendance_status: str = "Unknown"
    shipping_type: str = "Unknown"  # "To the Event" | city name | "Unknown"
    shipping_address_id: Optional[int] = Field(default=None, foreign_key="shippingaddress.id")
