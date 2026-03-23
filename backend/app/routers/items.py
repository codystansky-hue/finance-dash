from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from typing import List

router = APIRouter(prefix="/api/items", tags=["items"])

@router.get("/", response_model=List[schemas.RecurringItem])
def get_items(db: Session = Depends(get_db)):
    return db.query(models.RecurringItem).all()

@router.post("/", response_model=schemas.RecurringItem)
def create_item(item: schemas.RecurringItemCreate, db: Session = Depends(get_db)):
    db_item = models.RecurringItem(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item
