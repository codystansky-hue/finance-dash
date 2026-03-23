from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title='Finance Dashboard API')

@app.get('/')
def read_root():
    return {'message': 'Welcome to the Finance Dashboard API'}

@app.post('/recurring-items/', response_model=schemas.RecurringItem)
def create_recurring_item(item: schemas.RecurringItemCreate, db: Session = Depends(get_db)):
    db_item = models.RecurringItem(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.get('/recurring-items/', response_model=List[schemas.RecurringItem])
def read_recurring_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    items = db.query(models.RecurringItem).offset(skip).limit(limit).all()
    return items

@app.post('/cashflow/', response_model=schemas.MonthlyCashflow)
def create_cashflow(cashflow: schemas.MonthlyCashflowCreate, db: Session = Depends(get_db)):
    db_cf = models.MonthlyCashflow(**cashflow.model_dump())
    db.add(db_cf)
    db.commit()
    db.refresh(db_cf)
    return db_cf

@app.get('/cashflow/', response_model=List[schemas.MonthlyCashflow])
def read_cashflow(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    cf = db.query(models.MonthlyCashflow).offset(skip).limit(limit).all()
    return cf

if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='0.0.0.0', port=8000, reload=True)
