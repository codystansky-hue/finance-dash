from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from typing import List

router = APIRouter(prefix="/api/cashflow", tags=["cashflow"])

@router.get("/", response_model=List[schemas.Cashflow])
def get_cashflows(db: Session = Depends(get_db)):
    return db.query(models.Cashflow).all()

@router.post("/", response_model=schemas.Cashflow)
def create_cashflow(cashflow: schemas.CashflowCreate, db: Session = Depends(get_db)):
    db_cf = models.Cashflow(**cashflow.model_dump())
    db.add(db_cf)
    db.commit()
    db.refresh(db_cf)
    return db_cf
