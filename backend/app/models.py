from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class RecurringItem(Base):
    __tablename__ = "recurring_items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    amount = Column(Float)
    is_income = Column(Boolean, default=False)
    frequency = Column(String, default="monthly")
    day_of_month = Column(Integer, nullable=True)

class LinkedInstitution(Base):
    __tablename__ = "linked_institutions"
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(String, unique=True, index=True)
    institution_id = Column(String)
    institution_name = Column(String)
    access_token_encrypted = Column(String)
    accounts = relationship("BankAccount", back_populates="institution", cascade="all, delete-orphan")

class BankAccount(Base):
    __tablename__ = "bank_accounts"
    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("linked_institutions.id"))
    account_id = Column(String, unique=True, index=True)
    name = Column(String)
    official_name = Column(String, nullable=True)
    type = Column(String)
    subtype = Column(String, nullable=True)
    balance_current = Column(Float, nullable=True)
    balance_available = Column(Float, nullable=True)
    balance_limit = Column(Float, nullable=True)
    balance_statement = Column(Float, nullable=True)
    last_synced = Column(String, nullable=True)
    institution = relationship("LinkedInstitution", back_populates="accounts")

class SchwabAccount(Base):
    __tablename__ = "schwab_accounts"
    id = Column(Integer, primary_key=True, index=True)
    account_hash = Column(String, unique=True, index=True)
    account_number_last4 = Column(String)
    account_type = Column(String)          # MARGIN, CASH, IRA, etc.
    liquid_value = Column(Float, nullable=True)
    cash_balance = Column(Float, nullable=True)
    long_market_value = Column(Float, nullable=True)
    day_pnl = Column(Float, nullable=True)
    last_synced = Column(String, nullable=True)

class ManualAccount(Base):
    __tablename__ = "manual_accounts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    account_type = Column(String, default="checking")
    balance = Column(Float, default=0.0)
    notes = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)

class Cashflow(Base):
    __tablename__ = "cashflows"
    id = Column(Integer, primary_key=True, index=True)
    month = Column(String, index=True)
    total_income = Column(Float, default=0.0)
    total_expense = Column(Float, default=0.0)
