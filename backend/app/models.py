from sqlalchemy import Column, Integer, String, Float, Boolean
from .database import Base

class RecurringItem(Base):
    __tablename__ = "recurring_items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    amount = Column(Float)
    is_income = Column(Boolean, default=False)
    frequency = Column(String, default="monthly")

class Cashflow(Base):
    __tablename__ = "cashflows"
    id = Column(Integer, primary_key=True, index=True)
    month = Column(String, index=True)
    total_income = Column(Float, default=0.0)
    total_expense = Column(Float, default=0.0)
