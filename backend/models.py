from sqlalchemy import Column, Integer, String, Float, Date
from database import Base

class RecurringItem(Base):
    __tablename__ = 'recurring_items'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    amount = Column(Float)
    frequency = Column(String) # monthly, weekly, yearly
    next_due_date = Column(Date)

class MonthlyCashflow(Base):
    __tablename__ = 'monthly_cashflow'

    id = Column(Integer, primary_key=True, index=True)
    month = Column(String, index=True) # e.g., '2023-10'
    income = Column(Float, default=0.0)
    expenses = Column(Float, default=0.0)
    savings = Column(Float, default=0.0)
