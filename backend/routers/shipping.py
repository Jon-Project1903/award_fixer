import os
import csv
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select

from database import get_session
from models import (
    ShippingAddress, InventorShipping, InventorAttendance,
    PatentCrossRef, DbSourcePatent, DbSourceInventor,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["shipping"])


def recompute_shipping(session: Session, project_id: int) -> dict:
    """Recompute shipping destinations for all inventors based on attendance + addresses."""
    # Clear existing shipping records
    existing = session.exec(
        select(InventorShipping).where(InventorShipping.project_id == project_id)
    ).all()
    for row in existing:
        session.delete(row)
    session.flush()

    # Build address lookup by city (case-insensitive)
    addresses = session.exec(
        select(ShippingAddress).where(ShippingAddress.project_id == project_id)
    ).all()
    addr_by_city: dict[str, ShippingAddress] = {}
    for addr in addresses:
        if addr.city:
            addr_by_city[addr.city.strip().lower()] = addr

    # Build attendance lookup by employee_id (case-insensitive)
    attendance_rows = session.exec(
        select(InventorAttendance).where(InventorAttendance.project_id == project_id)
    ).all()
    att_by_emp: dict[str, str] = {}
    for att in attendance_rows:
        att_by_emp[att.employee_id.strip().lower()] = att.attendance_status

    # Get unique inventors from crossrefs
    crossrefs = session.exec(
        select(PatentCrossRef).where(
            PatentCrossRef.project_id == project_id,
            PatentCrossRef.db_source_patent_id != None,
        )
    ).all()

    seen_keys: set[str] = set()
    records = []
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
            # Skip opt-outs and termed
            if inv.award_type and inv.award_type.lower() == "opt-out":
                continue
            if inv.employment_status and inv.employment_status.lower() == "termed":
                continue

            emp_id = (inv.employee_id or "").strip()
            dedup_key = emp_id.lower() if emp_id else inv.legal_name.strip().lower()
            if dedup_key in seen_keys:
                continue
            seen_keys.add(dedup_key)

            # Determine attendance
            att_status = att_by_emp.get(dedup_key, "Unknown")

            # Determine shipping
            work_city = (inv.work_city or "").strip()
            if att_status == "In-Person":
                shipping_type = "To the Event"
                shipping_address_id = None
            elif work_city and work_city.lower() in addr_by_city:
                addr = addr_by_city[work_city.lower()]
                shipping_type = work_city
                shipping_address_id = addr.id
            else:
                shipping_type = "Unknown"
                shipping_address_id = None

            record = InventorShipping(
                project_id=project_id,
                employee_id=emp_id or inv.legal_name,
                inventor_name=inv.preferred_name or inv.legal_name,
                work_city=work_city or None,
                attendance_status=att_status,
                shipping_type=shipping_type,
                shipping_address_id=shipping_address_id,
            )
            session.add(record)
            records.append(record)

    session.commit()
    return {"computed": len(records)}


@router.post("/{project_id}/import/shipping-addresses")
async def upload_shipping_addresses(
    project_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    os.makedirs("uploads", exist_ok=True)
    path = f"uploads/shipping_{project_id}.csv"
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)

    # Clear existing addresses
    existing = session.exec(
        select(ShippingAddress).where(ShippingAddress.project_id == project_id)
    ).all()
    for row in existing:
        session.delete(row)
    session.flush()

    # Parse CSV
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            taxable_raw = (row.get("Taxable") or "").strip().upper()
            session.add(ShippingAddress(
                project_id=project_id,
                company=(row.get("Company") or "").strip() or None,
                ship_to=(row.get("Ship to") or "").strip() or None,
                email=(row.get("Distribution Mgr Email") or "").strip() or None,
                address_1=(row.get("Address 1") or "").strip() or None,
                address_2=(row.get("Address 2") or "").strip() or None,
                address_3=(row.get("Address 3") or "").strip() or None,
                phone=(row.get("Phone") or "").strip() or None,
                city=(row.get("City") or "").strip() or None,
                state=(row.get("State") or "").strip() or None,
                zip_code=(row.get("Zip Code") or "").strip() or None,
                country=(row.get("Country") or "").strip() or None,
                taxable=taxable_raw == "Y",
            ))
            count += 1

    session.commit()

    # Recompute shipping after address import
    result = recompute_shipping(session, project_id)
    return {"addresses_imported": count, **result}


@router.get("/{project_id}/shipping-addresses")
def list_shipping_addresses(project_id: int, session: Session = Depends(get_session)):
    return session.exec(
        select(ShippingAddress).where(ShippingAddress.project_id == project_id)
    ).all()


@router.post("/{project_id}/shipping-addresses")
def create_shipping_address(project_id: int, data: dict, session: Session = Depends(get_session)):
    addr = ShippingAddress(
        project_id=project_id,
        company=data.get("company"),
        ship_to=data.get("ship_to"),
        email=data.get("email"),
        address_1=data.get("address_1"),
        address_2=data.get("address_2"),
        address_3=data.get("address_3"),
        phone=data.get("phone"),
        city=data.get("city"),
        state=data.get("state"),
        zip_code=data.get("zip_code"),
        country=data.get("country"),
        taxable=data.get("taxable", False),
    )
    session.add(addr)
    session.commit()
    session.refresh(addr)
    recompute_shipping(session, project_id)
    return addr


@router.put("/{project_id}/shipping-addresses/{address_id}")
def update_shipping_address(project_id: int, address_id: int, data: dict, session: Session = Depends(get_session)):
    addr = session.get(ShippingAddress, address_id)
    if not addr or addr.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    for field in ["company", "ship_to", "email", "address_1", "address_2", "address_3",
                  "phone", "city", "state", "zip_code", "country", "taxable"]:
        if field in data:
            setattr(addr, field, data[field])
    session.add(addr)
    session.commit()
    session.refresh(addr)
    recompute_shipping(session, project_id)
    return addr


@router.delete("/{project_id}/shipping-addresses/{address_id}")
def delete_shipping_address(project_id: int, address_id: int, session: Session = Depends(get_session)):
    addr = session.get(ShippingAddress, address_id)
    if not addr or addr.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(addr)
    session.commit()
    recompute_shipping(session, project_id)
    return {"ok": True}


@router.get("/{project_id}/shipping")
def list_shipping(project_id: int, session: Session = Depends(get_session)):
    rows = session.exec(
        select(InventorShipping).where(InventorShipping.project_id == project_id)
    ).all()
    # Attach address details
    result = []
    for row in rows:
        data = row.model_dump()
        if row.shipping_address_id:
            addr = session.get(ShippingAddress, row.shipping_address_id)
            if addr:
                data["shipping_address"] = addr.model_dump()
        else:
            data["shipping_address"] = None
        result.append(data)
    return result


@router.post("/{project_id}/shipping/recompute")
def recompute_shipping_endpoint(project_id: int, session: Session = Depends(get_session)):
    return recompute_shipping(session, project_id)


@router.put("/{project_id}/shipping/{shipping_id}")
def update_shipping(
    project_id: int,
    shipping_id: int,
    data: dict,
    session: Session = Depends(get_session),
):
    record = session.get(InventorShipping, shipping_id)
    if not record or record.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    if "shipping_type" in data:
        record.shipping_type = data["shipping_type"]
    if "shipping_address_id" in data:
        record.shipping_address_id = data["shipping_address_id"]
    session.add(record)
    session.commit()
    session.refresh(record)
    return record
