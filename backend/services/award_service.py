import logging
from collections import defaultdict
from sqlmodel import Session, select

from models import (
    PatentCrossRef, DbSourcePatent, DbSourceInventor,
    PhysicalAward, AwardCost, TaxRate, ProgramMgmtFee,
)

logger = logging.getLogger(__name__)


def generate_physical_awards(session: Session, project_id: int) -> dict:
    """Generate physical award rows from reconciled patents."""
    # Clear existing
    existing = session.exec(
        select(PhysicalAward).where(PhysicalAward.project_id == project_id)
    ).all()
    for row in existing:
        session.delete(row)
    session.flush()

    # Get all crossrefs that have a db_source patent
    crossrefs = session.exec(
        select(PatentCrossRef).where(
            PatentCrossRef.project_id == project_id,
            PatentCrossRef.db_source_patent_id != None,
        )
    ).all()

    awards = []
    for cr in crossrefs:
        db_pat = session.get(DbSourcePatent, cr.db_source_patent_id)
        if not db_pat:
            continue

        inventors = session.exec(
            select(DbSourceInventor).where(
                DbSourceInventor.db_source_patent_id == db_pat.id
            )
        ).all()

        for inv in inventors:
            # Skip opt-outs and termed employees
            if inv.award_type and inv.award_type.lower() == "opt-out":
                continue
            if inv.employment_status and inv.employment_status.lower() == "termed":
                continue

            award = PhysicalAward(
                project_id=project_id,
                employee_id=inv.employee_id or inv.legal_name,
                patent_number=db_pat.patent_no,
                award_type=inv.award_type or "Unknown",
                inventor_name=inv.preferred_name or inv.legal_name,
                work_state=inv.work_state,
            )
            session.add(award)
            awards.append(award)

    session.commit()
    logger.info("Generated %d physical awards for project %d", len(awards), project_id)
    return {"generated": len(awards)}


def compute_cost_summary(session: Session, project_id: int) -> dict:
    """Compute full cost breakdown with taxes by jurisdiction."""
    awards = session.exec(
        select(PhysicalAward).where(PhysicalAward.project_id == project_id)
    ).all()

    # Load cost lookup
    costs = session.exec(
        select(AwardCost).where(AwardCost.project_id == project_id)
    ).all()
    cost_by_type = {c.award_type: c.cost for c in costs}

    # Load tax lookup by lookup_key (state code)
    tax_rates = session.exec(
        select(TaxRate).where(TaxRate.project_id == project_id)
    ).all()
    tax_by_key = {r.lookup_key: r for r in tax_rates}

    # Group awards by type
    by_type: dict[str, list[PhysicalAward]] = defaultdict(list)
    for a in awards:
        by_type[a.award_type].append(a)

    # Line items
    line_items = []
    subtotal = 0.0
    for award_type, type_awards in sorted(by_type.items()):
        qty = len(type_awards)
        unit_cost = cost_by_type.get(award_type, 0.0)
        total = qty * unit_cost
        subtotal += total
        line_items.append({
            "award_type": award_type,
            "quantity": qty,
            "unit_cost": unit_cost,
            "total": round(total, 2),
        })

    # Tax calculation per award
    total_tax = 0.0
    tax_by_jurisdiction: dict[str, dict] = defaultdict(lambda: {"taxable_amount": 0.0, "tax": 0.0, "rate": 0.0})
    for a in awards:
        unit_cost = cost_by_type.get(a.award_type, 0.0)
        state = (a.work_state or "").strip()
        if state and state in tax_by_key:
            rate_info = tax_by_key[state]
            tax = unit_cost * (rate_info.tax_percent / 100.0)
            total_tax += tax
            entry = tax_by_jurisdiction[rate_info.jurisdiction]
            entry["taxable_amount"] += unit_cost
            entry["tax"] += tax
            entry["rate"] = rate_info.tax_percent

    # Round tax values
    total_tax = round(total_tax, 2)
    tax_breakdown = []
    for jurisdiction, info in sorted(tax_by_jurisdiction.items()):
        tax_breakdown.append({
            "jurisdiction": jurisdiction,
            "taxable_amount": round(info["taxable_amount"], 2),
            "tax": round(info["tax"], 2),
            "rate": info["rate"],
        })

    subtotal_with_tax = round(subtotal + total_tax, 2)

    # PM Fees
    pm_fees = session.exec(
        select(ProgramMgmtFee).where(ProgramMgmtFee.project_id == project_id)
    ).all()
    pm_total = sum(f.quantity * f.cost for f in pm_fees)
    pm_items = [
        {
            "id": f.id,
            "description": f.description,
            "quantity": f.quantity,
            "unit_cost": f.cost,
            "total": round(f.quantity * f.cost, 2),
        }
        for f in pm_fees
    ]

    grand_total = round(subtotal_with_tax + pm_total, 2)

    return {
        "line_items": line_items,
        "subtotal": round(subtotal, 2),
        "total_tax": total_tax,
        "tax_breakdown": tax_breakdown,
        "subtotal_with_tax": subtotal_with_tax,
        "pm_fees": pm_items,
        "pm_total": round(pm_total, 2),
        "grand_total": grand_total,
        "total_awards": len(awards),
    }
