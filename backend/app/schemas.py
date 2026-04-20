from pydantic import BaseModel
from typing import Optional

class RecurringItemBase(BaseModel):
    name: str
    amount: float
    is_income: bool = False
    frequency: str = "monthly"
    day_of_month: Optional[int] = None

class RecurringItemCreate(RecurringItemBase):
    pass

class RecurringItem(RecurringItemBase):
    id: int
    class Config:
        from_attributes = True

class BankAccount(BaseModel):
    id: int
    account_id: str
    name: str
    official_name: Optional[str]
    type: str
    subtype: Optional[str]
    balance_current: Optional[float]
    balance_available: Optional[float]
    balance_limit: Optional[float]
    balance_statement: Optional[float]
    last_synced: Optional[str]
    class Config:
        from_attributes = True

class LinkedInstitution(BaseModel):
    id: int
    institution_name: str
    accounts: list[BankAccount] = []
    class Config:
        from_attributes = True

class SchwabAccount(BaseModel):
    id: int
    account_hash: str
    account_number_last4: Optional[str]
    account_type: Optional[str]
    liquid_value: Optional[float]
    cash_balance: Optional[float]
    long_market_value: Optional[float]
    day_pnl: Optional[float]
    last_synced: Optional[str]
    class Config:
        from_attributes = True

class ManualAccountBase(BaseModel):
    name: str
    account_type: str = "checking"
    balance: float = 0.0
    notes: Optional[str] = None

class ManualAccountCreate(ManualAccountBase):
    pass

class ManualAccountUpdate(BaseModel):
    balance: float
    notes: Optional[str] = None

class ManualAccount(ManualAccountBase):
    id: int
    updated_at: Optional[str]
    class Config:
        from_attributes = True

class ExchangeTokenRequest(BaseModel):
    public_token: str
    institution_id: str
    institution_name: str

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
