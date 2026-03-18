from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models import (
    PhysicalAward, OptOutAward, TermedAward,
    PatentCrossRef, DbSourcePatent, DbSourceInventor,
    UnifiedPatent, UnifiedInventor,
)
from services.award_service import generate_physical_awards, compute_cost_summary

router = APIRouter(prefix="/api/projects", tags=["awards"])


@router.post("/{project_id}/generate-awards")
def generate_awards(project_id: int, session: Session = Depends(get_session)):
    return generate_physical_awards(session, project_id)


# ── Physical Awards ─────────────────────────────────────────

@router.get("/{project_id}/physical-awards")
def list_physical_awards(project_id: int, session: Session = Depends(get_session)):
    return session.exec(
        select(PhysicalAward).where(PhysicalAward.project_id == project_id)
    ).all()


@router.post("/{project_id}/physical-awards")
def create_physical_award(project_id: int, data: dict, session: Session = Depends(get_session)):
    award = PhysicalAward(
        project_id=project_id,
        employee_id=data["employee_id"],
        patent_number=data["patent_number"],
        award_type=data["award_type"],
        inventor_name=data.get("inventor_name", ""),
        work_state=data.get("work_state"),
    )
    session.add(award)
    session.commit()
    session.refresh(award)
    return award


@router.put("/{project_id}/physical-awards/{award_id}")
def update_physical_award(
    project_id: int, award_id: int, data: dict,
    session: Session = Depends(get_session),
):
    award = session.get(PhysicalAward, award_id)
    if not award or award.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    for field in ("employee_id", "patent_number", "award_type", "inventor_name", "work_state"):
        if field in data:
            setattr(award, field, data[field])
    session.add(award)
    session.commit()
    session.refresh(award)
    return award


@router.delete("/{project_id}/physical-awards/{award_id}")
def delete_physical_award(
    project_id: int, award_id: int,
    session: Session = Depends(get_session),
):
    award = session.get(PhysicalAward, award_id)
    if not award or award.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(award)
    session.commit()
    return {"ok": True}


# ── Opt-Out Awards ──────────────────────────────────────────

@router.get("/{project_id}/opt-out-awards")
def list_opt_out_awards(project_id: int, session: Session = Depends(get_session)):
    return session.exec(
        select(OptOutAward).where(OptOutAward.project_id == project_id)
    ).all()


# ── Termed Awards ───────────────────────────────────────────

@router.get("/{project_id}/termed-awards")
def list_termed_awards(project_id: int, session: Session = Depends(get_session)):
    return session.exec(
        select(TermedAward).where(TermedAward.project_id == project_id)
    ).all()


# ── Award Stats ─────────────────────────────────────────────

@router.get("/{project_id}/award-stats")
def get_award_stats(project_id: int, session: Session = Depends(get_session)):
    """Return stats about awards, inventor counts, and discrepancies."""
    # Physical awards by type
    awards = session.exec(
        select(PhysicalAward).where(PhysicalAward.project_id == project_id)
    ).all()
    by_type: dict[str, int] = defaultdict(int)
    for a in awards:
        by_type[a.award_type] += 1

    opt_outs = session.exec(
        select(OptOutAward).where(OptOutAward.project_id == project_id)
    ).all()

    termed = session.exec(
        select(TermedAward).where(TermedAward.project_id == project_id)
    ).all()

    # Count inventors across all patents from each source
    db_patents = session.exec(
        select(DbSourcePatent).where(DbSourcePatent.project_id == project_id)
    ).all()
    total_db_inventors = 0
    for p in db_patents:
        count = len(session.exec(
            select(DbSourceInventor).where(DbSourceInventor.db_source_patent_id == p.id)
        ).all())
        total_db_inventors += count

    uni_patents = session.exec(
        select(UnifiedPatent).where(UnifiedPatent.project_id == project_id)
    ).all()
    total_uni_inventors = 0
    for p in uni_patents:
        count = len(session.exec(
            select(UnifiedInventor).where(UnifiedInventor.unified_patent_id == p.id)
        ).all())
        total_uni_inventors += count

    # Reconciled = physical awards + opt-outs + termed
    total_reconciled = len(awards) + len(opt_outs) + len(termed)

    # Discrepancies
    discrepancies = []
    if total_db_inventors != total_uni_inventors:
        discrepancies.append(
            f"DB has {total_db_inventors} inventors vs Unified has {total_uni_inventors} inventors"
        )
    if total_reconciled != total_db_inventors:
        diff = total_db_inventors - total_reconciled
        discrepancies.append(
            f"{abs(diff)} inventor(s) {'not accounted for' if diff > 0 else 'extra'} in awards vs DB source"
        )

    return {
        "by_type": dict(sorted(by_type.items())),
        "total_awards": len(awards),
        "opt_outs": len(opt_outs),
        "termed": len(termed),
        "total_db_inventors": total_db_inventors,
        "total_uni_inventors": total_uni_inventors,
        "total_reconciled": total_reconciled,
        "discrepancies": discrepancies,
    }


# ── Cost Summary ────────────────────────────────────────────

@router.get("/{project_id}/cost-summary")
def get_cost_summary(project_id: int, session: Session = Depends(get_session)):
    return compute_cost_summary(session, project_id)
