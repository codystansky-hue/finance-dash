from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional

from .. import models
from ..database import get_db
from .timetracker import get_invoices

router = APIRouter(prefix="/api/projection", tags=["projection"])


@router.get("/cashflow")
def cashflow_projection(days: int = 14, db: Session = Depends(get_db)):
    today = date.today()

    # Determine next calendar month boundaries.
    if today.month == 12:
        next_month_year, next_month_num = today.year + 1, 1
    else:
        next_month_year, next_month_num = today.year, today.month + 1

    next_month_1 = date(next_month_year, next_month_num, 1)

    # Find the latest recurring expense due date in next month so the window
    # extends past it — this is the "rolling cashflow window" that always shows
    # upcoming credit-card payment due dates.
    items = db.query(models.RecurringItem).all()
    last_next_month_due: Optional[date] = None
    for item in items:
        if item.day_of_month is None or item.is_income:
            continue
        try:
            candidate = date(next_month_year, next_month_num, item.day_of_month)
        except ValueError:
            continue
        if last_next_month_due is None or candidate > last_next_month_due:
            last_next_month_due = candidate

    # Window end: at least 14 days out, always past the 1st of next month,
    # and past the last expense due date in next month (+ 1 day so that date
    # is clearly inside the window).
    end = max(today + timedelta(days=days), next_month_1)
    if last_next_month_due is not None:
        end = max(end, last_next_month_due + timedelta(days=1))

    # Starting balance: sum of all manual accounts
    manual_accounts = db.query(models.ManualAccount).all()
    starting_balance = sum(a.balance for a in manual_accounts)

    # Build events: find next occurrence of each item within the window
    events: list[dict] = []
    for item in items:
        if item.day_of_month is None:
            continue
        dom = item.day_of_month
        # Find next occurrence on or after today
        try:
            candidate = date(today.year, today.month, dom)
        except ValueError:
            continue
        if candidate < today:
            # Roll to next month
            if today.month == 12:
                candidate = date(today.year + 1, 1, dom)
            else:
                try:
                    candidate = date(today.year, today.month + 1, dom)
                except ValueError:
                    continue
        if candidate > end:
            continue
        events.append({
            "date": candidate.isoformat(),
            "name": item.name,
            "amount": item.amount,
            "is_income": item.is_income,
        })

    # Include upcoming unpaid invoices (due on or after today) within the window.
    # Overdue invoices are excluded — they are already late and shown in the
    # invoice summary panel; pinning them to today would misrepresent cash flow.
    try:
        invoices = get_invoices(status="unpaid")
        for inv in invoices:
            if inv["total_amount"] <= 0:
                continue
            due = date.fromisoformat(inv["due_date"])
            if due < today:
                continue  # overdue — skip
            # Extend the window so upcoming invoice due dates are always visible
            end = max(end, due)
            events.append({
                "date": due.isoformat(),
                "name": f"{inv['client_name']} ({inv['invoice_number']})",
                "amount": inv["total_amount"],
                "is_income": True,
            })
    except Exception:
        pass

    # Sort by date then name
    events.sort(key=lambda e: (e["date"], e["name"]))

    # Build running balance timeline
    timeline = []
    balance = starting_balance
    for event in events:
        delta = event["amount"] if event["is_income"] else -event["amount"]
        balance += delta
        timeline.append({
            "date": event["date"],
            "name": event["name"],
            "amount": event["amount"],
            "is_income": event["is_income"],
            "balance_after": round(balance, 2),
        })

    return {
        "starting_balance": round(starting_balance, 2),
        "ending_balance": round(balance, 2),
        "from_date": today.isoformat(),
        "to_date": end.isoformat(),
        "events": timeline,
        "manual_accounts": [{"name": a.name, "balance": a.balance} for a in manual_accounts],
    }
