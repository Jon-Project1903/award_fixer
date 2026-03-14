from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models import AwardCost, TaxRate, ProgramMgmtFee

router = APIRouter(prefix="/api/projects", tags=["costs"])


# ── Award Costs ──────────────────────────────────────────────

@router.get("/{project_id}/costs")
def list_costs(project_id: int, session: Session = Depends(get_session)):
    return session.exec(
        select(AwardCost).where(AwardCost.project_id == project_id)
    ).all()


@router.post("/{project_id}/costs")
def create_cost(project_id: int, data: dict, session: Session = Depends(get_session)):
    cost = AwardCost(
        project_id=project_id,
        award_type=data["award_type"],
        cost=data["cost"],
    )
    session.add(cost)
    session.commit()
    session.refresh(cost)
    return cost


@router.put("/{project_id}/costs/{cost_id}")
def update_cost(project_id: int, cost_id: int, data: dict, session: Session = Depends(get_session)):
    cost = session.get(AwardCost, cost_id)
    if not cost or cost.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    if "award_type" in data:
        cost.award_type = data["award_type"]
    if "cost" in data:
        cost.cost = data["cost"]
    session.add(cost)
    session.commit()
    session.refresh(cost)
    return cost


@router.delete("/{project_id}/costs/{cost_id}")
def delete_cost(project_id: int, cost_id: int, session: Session = Depends(get_session)):
    cost = session.get(AwardCost, cost_id)
    if not cost or cost.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(cost)
    session.commit()
    return {"ok": True}


# ── Tax Rates ────────────────────────────────────────────────

@router.get("/{project_id}/tax-rates")
def list_tax_rates(project_id: int, session: Session = Depends(get_session)):
    return session.exec(
        select(TaxRate).where(TaxRate.project_id == project_id)
    ).all()


@router.post("/{project_id}/tax-rates")
def create_tax_rate(project_id: int, data: dict, session: Session = Depends(get_session)):
    rate = TaxRate(
        project_id=project_id,
        jurisdiction=data["jurisdiction"],
        lookup_key=data["lookup_key"],
        tax_percent=data["tax_percent"],
    )
    session.add(rate)
    session.commit()
    session.refresh(rate)
    return rate


@router.put("/{project_id}/tax-rates/{rate_id}")
def update_tax_rate(project_id: int, rate_id: int, data: dict, session: Session = Depends(get_session)):
    rate = session.get(TaxRate, rate_id)
    if not rate or rate.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    for field in ("jurisdiction", "lookup_key", "tax_percent"):
        if field in data:
            setattr(rate, field, data[field])
    session.add(rate)
    session.commit()
    session.refresh(rate)
    return rate


@router.delete("/{project_id}/tax-rates/{rate_id}")
def delete_tax_rate(project_id: int, rate_id: int, session: Session = Depends(get_session)):
    rate = session.get(TaxRate, rate_id)
    if not rate or rate.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(rate)
    session.commit()
    return {"ok": True}


# ── Program Management Fees ──────────────────────────────────

@router.get("/{project_id}/pm-fees")
def list_pm_fees(project_id: int, session: Session = Depends(get_session)):
    return session.exec(
        select(ProgramMgmtFee).where(ProgramMgmtFee.project_id == project_id)
    ).all()


@router.post("/{project_id}/pm-fees")
def create_pm_fee(project_id: int, data: dict, session: Session = Depends(get_session)):
    fee = ProgramMgmtFee(
        project_id=project_id,
        description=data["description"],
        quantity=data.get("quantity", 1),
        cost=data["cost"],
    )
    session.add(fee)
    session.commit()
    session.refresh(fee)
    return fee


@router.put("/{project_id}/pm-fees/{fee_id}")
def update_pm_fee(project_id: int, fee_id: int, data: dict, session: Session = Depends(get_session)):
    fee = session.get(ProgramMgmtFee, fee_id)
    if not fee or fee.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    for field in ("description", "quantity", "cost"):
        if field in data:
            setattr(fee, field, data[field])
    session.add(fee)
    session.commit()
    session.refresh(fee)
    return fee


@router.delete("/{project_id}/pm-fees/{fee_id}")
def delete_pm_fee(project_id: int, fee_id: int, session: Session = Depends(get_session)):
    fee = session.get(ProgramMgmtFee, fee_id)
    if not fee or fee.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(fee)
    session.commit()
    return {"ok": True}
