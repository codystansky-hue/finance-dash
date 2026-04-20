import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet
from dotenv import load_dotenv
import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.liabilities_get_request import LiabilitiesGetRequest
from plaid.model.country_code import CountryCode
from plaid.model.products import Products
from typing import List

from .. import models, schemas
from ..database import get_db

load_dotenv()

PLAID_CLIENT_ID = os.getenv("PLAID_CLIENT_ID")
PLAID_SECRET = os.getenv("PLAID_SECRET")
PLAID_ENV = os.getenv("PLAID_ENV", "sandbox")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

_env_map = {
    "sandbox": plaid.Environment.Sandbox,
    "development": "https://development.plaid.com",
    "production": plaid.Environment.Production,
}

configuration = plaid.Configuration(
    host=_env_map.get(PLAID_ENV, plaid.Environment.Sandbox),
    api_key={"clientId": PLAID_CLIENT_ID, "secret": PLAID_SECRET},
)
api_client = plaid.ApiClient(configuration)
plaid_client = plaid_api.PlaidApi(api_client)

fernet = Fernet(ENCRYPTION_KEY.encode()) if ENCRYPTION_KEY else None


def encrypt(token: str) -> str:
    return fernet.encrypt(token.encode()).decode()


def decrypt(token: str) -> str:
    return fernet.decrypt(token.encode()).decode()


router = APIRouter(prefix="/api/plaid", tags=["plaid"])


@router.post("/create-link-token")
def create_link_token():
    if not PLAID_CLIENT_ID or PLAID_CLIENT_ID == "your_client_id_here":
        raise HTTPException(status_code=503, detail="Plaid credentials not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to backend/.env")
    try:
        request = LinkTokenCreateRequest(
            user=LinkTokenCreateRequestUser(client_user_id="local-user"),
            client_name="Finance Dashboard",
            products=[Products("transactions"), Products("liabilities")],
            country_codes=[CountryCode("US")],
            language="en",
            redirect_uri="https://localhost:3001/oauth-return",
        )
        response = plaid_client.link_token_create(request)
        return {"link_token": response["link_token"]}
    except plaid.ApiException as e:
        raise HTTPException(status_code=400, detail=str(e.body))


@router.post("/exchange-token", response_model=schemas.LinkedInstitution)
def exchange_token(body: schemas.ExchangeTokenRequest, db: Session = Depends(get_db)):
    try:
        exchange_request = ItemPublicTokenExchangeRequest(public_token=body.public_token)
        exchange_response = plaid_client.item_public_token_exchange(exchange_request)
        access_token = exchange_response["access_token"]
        item_id = exchange_response["item_id"]
    except plaid.ApiException as e:
        raise HTTPException(status_code=400, detail=str(e.body))

    existing = db.query(models.LinkedInstitution).filter_by(item_id=item_id).first()
    if existing:
        existing.access_token_encrypted = encrypt(access_token)
        db.commit()
        institution = existing
    else:
        institution = models.LinkedInstitution(
            item_id=item_id,
            institution_id=body.institution_id,
            institution_name=body.institution_name,
            access_token_encrypted=encrypt(access_token),
        )
        db.add(institution)
        db.commit()
        db.refresh(institution)

    _sync_balances(institution, access_token, db)
    db.refresh(institution)
    return institution


@router.post("/sync/{institution_id}", response_model=schemas.LinkedInstitution)
def sync_balances(institution_id: int, db: Session = Depends(get_db)):
    institution = db.query(models.LinkedInstitution).filter_by(id=institution_id).first()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")
    access_token = decrypt(institution.access_token_encrypted)
    _sync_balances(institution, access_token, db)
    db.refresh(institution)
    return institution


@router.get("/accounts", response_model=List[schemas.LinkedInstitution])
def get_accounts(db: Session = Depends(get_db)):
    return db.query(models.LinkedInstitution).all()


def _sync_balances(institution: models.LinkedInstitution, access_token: str, db: Session):
    try:
        response = plaid_client.accounts_get(AccountsGetRequest(access_token=access_token))
    except plaid.ApiException as e:
        raise HTTPException(status_code=400, detail=str(e.body))

    # Fetch statement balances for credit accounts if liabilities product is available
    statement_map: dict = {}
    try:
        liab = plaid_client.liabilities_get(LiabilitiesGetRequest(access_token=access_token))
        for card in liab["liabilities"].get("credit", []):
            statement_map[card["account_id"]] = card.get("last_statement_balance")
    except plaid.ApiException:
        pass  # liabilities not enabled for this token

    now = datetime.now(timezone.utc).isoformat()
    for acct in response["accounts"]:
        balances = acct["balances"]
        account_id = acct["account_id"]
        stmt_balance = statement_map.get(account_id)
        existing = db.query(models.BankAccount).filter_by(account_id=account_id).first()
        if existing:
            existing.balance_current = balances.get("current")
            existing.balance_available = balances.get("available")
            existing.balance_limit = balances.get("limit")
            if stmt_balance is not None:
                existing.balance_statement = stmt_balance
            existing.last_synced = now
        else:
            db.add(models.BankAccount(
                institution_id=institution.id,
                account_id=account_id,
                name=acct["name"],
                official_name=acct.get("official_name"),
                type=str(acct["type"]),
                subtype=str(acct.get("subtype", "")),
                balance_current=balances.get("current"),
                balance_available=balances.get("available"),
                balance_limit=balances.get("limit"),
                balance_statement=stmt_balance,
                last_synced=now,
            ))
    db.commit()
