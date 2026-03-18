import logging
from collections import defaultdict
from sqlmodel import Session, select

from models import (
    PatentCrossRef, DbSourcePatent, DbSourceInventor,
    PhysicalAward, OptOutAward, TermedAward,
    AwardCost, TaxRate, ProgramMgmtFee,
    ReconciliationChoice,
)

logger = logging.getLogger(__name__)


def generate_physical_awards(session: Session, project_id: int) -> dict:
    """Generate physical award, opt-out, and termed rows from reconciled patents."""
    # Clear existing
    for model in (PhysicalAward, OptOutAward, TermedAward):
        existing = session.exec(select(model).where(model.project_id == project_id)).all()
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
    opt_outs = []
    termed = []
    for cr in crossrefs:
        if cr.erroneous:
            continue
        db_pat = session.get(DbSourcePatent, cr.db_source_patent_id)
        if not db_pat:
            continue

        inventors = session.exec(
            select(DbSourceInventor).where(
                DbSourceInventor.db_source_patent_id == db_pat.id
            )
        ).all()

        for inv in inventors:
            common = dict(
                project_id=project_id,
                employee_id=inv.employee_id or inv.legal_name,
                patent_number=db_pat.patent_no,
                inventor_name=inv.preferred_name or inv.legal_name,
                work_state=inv.work_state,
                work_city=inv.work_city,
            )

            if inv.award_type and inv.award_type.lower() == "opt-out":
                row = OptOutAward(**common)
                session.add(row)
                opt_outs.append(row)
            elif inv.employment_status and inv.employment_status.lower() == "termed":
                row = TermedAward(**common)
                session.add(row)
                termed.append(row)
            else:
                row = PhysicalAward(
                    **common,
                    award_type=inv.award_type or "Unknown",
                )
                session.add(row)
                awards.append(row)

    session.commit()
    logger.info("Generated %d awards, %d opt-outs, %d termed for project %d",
                len(awards), len(opt_outs), len(termed), project_id)
    return {"generated": len(awards), "opt_outs": len(opt_outs), "termed": len(termed)}


def sync_awards_from_crossref(session: Session, crossref_id: int) -> dict:
    """Update existing physical awards based on reconciliation choices for a crossref.
    If physical awards exist for this patent, update their inventor_name from choices.
    Returns count of updated awards."""
    cr = session.get(PatentCrossRef, crossref_id)
    if not cr or not cr.db_source_patent_id:
        return {"updated": 0}

    db_pat = session.get(DbSourcePatent, cr.db_source_patent_id)
    if not db_pat:
        return {"updated": 0}

    # Check if any physical awards exist for this project
    all_awards = session.exec(
        select(PhysicalAward).where(PhysicalAward.project_id == cr.project_id)
    ).all()
    if not all_awards:
        return {"updated": 0}

    # Get choices for this crossref
    choices = session.exec(
        select(ReconciliationChoice).where(ReconciliationChoice.crossref_id == crossref_id)
    ).all()
    choices_map = {c.field_name: c.chosen_value for c in choices}

    # Find awards matching this patent
    matching_awards = session.exec(
        select(PhysicalAward).where(
            PhysicalAward.project_id == cr.project_id,
            PhysicalAward.patent_number == db_pat.patent_no,
        )
    ).all()

    # Get db inventors to map awards to inventor choices
    db_inventors = session.exec(
        select(DbSourceInventor).where(DbSourceInventor.db_source_patent_id == db_pat.id)
    ).all()

    updated = 0
    for award in matching_awards:
        # Find the matching db inventor by employee_id or name
        matched_inv = None
        for inv in db_inventors:
            if (inv.employee_id and inv.employee_id == award.employee_id) or \
               inv.legal_name == award.inventor_name or \
               (inv.preferred_name and inv.preferred_name == award.inventor_name):
                matched_inv = inv
                break

        if matched_inv:
            # Check if there's a name choice for this inventor
            name_field = f"inventor_{matched_inv.id}_name"
            if name_field in choices_map:
                award.inventor_name = choices_map[name_field]
                updated += 1

            # Check if inventor is excluded
            include_field = f"inventor_{matched_inv.id}_include"
            if include_field in choices_map and choices_map[include_field] == 'no':
                session.delete(award)
                updated += 1
                continue

        session.add(award)

    session.commit()
    logger.info("Synced %d physical awards for crossref %d", updated, crossref_id)
    return {"updated": updated}


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
        city = (a.work_city or "").strip()
        if city and city in tax_by_key:
            rate_info = tax_by_key[city]
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
