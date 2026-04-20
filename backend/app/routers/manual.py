from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/manual-accounts", tags=["manual-accounts"])


@router.get("/", response_model=List[schemas.ManualAccount])
def get_accounts(db: Session = Depends(get_db)):
    return db.query(models.ManualAccount).all()


@router.post("/", response_model=schemas.ManualAccount)
def create_account(body: schemas.ManualAccountCreate, db: Session = Depends(get_db)):
    acct = models.ManualAccount(**body.model_dump(), updated_at=datetime.now(timezone.utc).isoformat())
    db.add(acct)
    db.commit()
    db.refresh(acct)
    return acct


@router.patch("/{account_id}", response_model=schemas.ManualAccount)
def update_account(account_id: int, body: schemas.ManualAccountUpdate, db: Session = Depends(get_db)):
    acct = db.query(models.ManualAccount).filter_by(id=account_id).first()
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")
    acct.balance = body.balance
    if body.notes is not None:
        acct.notes = body.notes
    acct.updated_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(acct)
    return acct


@router.delete("/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    acct = db.query(models.ManualAccount).filter_by(id=account_id).first()
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(acct)
    db.commit()
    return {"ok": True}
