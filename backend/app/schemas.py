from pydantic import BaseModel
from typing import Optional

class RecurringItemBase(BaseModel):
    name: str
    amount: float
    is_income: bool = False
    frequency: str = "monthly"

class RecurringItemCreate(RecurringItemBase):
    pass

class RecurringItem(RecurringItemBase):
    id: int
    class Config:
        from_attributes = True

class CashflowBase(BaseModel):
    month: str
    total_income: float
    total_expense: float

class CashflowCreate(CashflowBase):
    pass

class Cashflow(CashflowBase):
    id: int
    class Config:
        from_attributes = True
