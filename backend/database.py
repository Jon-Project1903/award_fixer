import logging
from sqlmodel import SQLModel, Session, create_engine, text

logger = logging.getLogger(__name__)

DATABASE_URL = "sqlite:///./patent_awards.db"

engine = create_engine(DATABASE_URL, echo=False)

# Columns added to existing tables after initial creation
_MIGRATIONS = [
    ("dbsourceinventor", "work_city", "VARCHAR"),
    ("dbsourceinventor", "work_state", "VARCHAR"),
    ("dbsourceinventor", "work_email", "VARCHAR"),
    ("dbsourceinventor", "preferred_name", "VARCHAR"),
    ("dbsourceinventor", "employment_status", "VARCHAR"),
    ("dbsourceinventor", "employee_id", "VARCHAR"),
    ("physicalaward", "work_city", "VARCHAR"),
    ("taxrate", "state", "VARCHAR"),
]


def _run_migrations():
    """Add new columns to existing tables (idempotent)."""
    with engine.connect() as conn:
        for table, column, col_type in _MIGRATIONS:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                conn.commit()
                logger.info("Added column %s.%s", table, column)
            except Exception:
                conn.rollback()  # column already exists


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    _run_migrations()


def get_session():
    with Session(engine) as session:
        yield session
