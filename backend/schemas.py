from pydantic import BaseModel
from typing import Optional
from datetime import date

class RecurringItemBase(BaseModel):
    name: str
    amount: float
    frequency: str
    next_due_date: date

class RecurringItemCreate(RecurringItemBase):
    pass

class RecurringItem(RecurringItemBase):
    id: int

    class Config:
        from_attributes = True

class MonthlyCashflowBase(BaseModel):
    month: str
    income: float
    expenses: float
    savings: float
    invoiced_unbilled_income: float = 0.0

class MonthlyCashflowCreate(MonthlyCashflowBase):
    pass

class MonthlyCashflow(MonthlyCashflowBase):
    id: int

    class Config:
        from_attributes = True
