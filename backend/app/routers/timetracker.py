import sqlite3
from pathlib import Path
from fastapi import APIRouter
from typing import Optional

router = APIRouter(prefix="/api/invoices", tags=["invoices"])

DB_PATH = Path(__file__).parent.parent.parent.parent.parent / "timetracker" / "time_tracker.db"


def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_invoices(status: Optional[str] = None):
    conn = _conn()
    cur = conn.cursor()
    if status:
        cur.execute(
            "SELECT i.*, c.name as client_name FROM invoices i "
            "JOIN clients c ON i.client_id = c.id WHERE i.status = ? ORDER BY i.due_date DESC",
            (status,),
        )
    else:
        cur.execute(
            "SELECT i.*, c.name as client_name FROM invoices i "
            "JOIN clients c ON i.client_id = c.id ORDER BY i.due_date DESC"
        )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


@router.get("/summary")
def invoice_summary():
    conn = _conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT COALESCE(SUM(e.duration_min / 60.0 * IFNULL(c.hourly_rate, 0)), 0) as total
        FROM entries e
        JOIN clients c ON e.client_id = c.id
        WHERE e.invoice_id IS NULL AND e.end_ts IS NOT NULL AND e.duration_min IS NOT NULL
    """)
    unbilled_total = cur.fetchone()["total"]

    from datetime import date
    today = date.today().isoformat()

    cur.execute(
        "SELECT i.*, c.name as client_name FROM invoices i "
        "JOIN clients c ON i.client_id = c.id WHERE i.status = 'unpaid' ORDER BY i.due_date ASC"
    )
    all_unpaid = [dict(r) for r in cur.fetchall()]
    overdue_invoices = [i for i in all_unpaid if i["due_date"] < today]
    upcoming_invoices = [i for i in all_unpaid if i["due_date"] >= today]
    overdue_total = sum(i["total_amount"] for i in overdue_invoices)
    upcoming_total = sum(i["total_amount"] for i in upcoming_invoices)

    conn.close()
    return {
        "unbilled_total": unbilled_total,
        "overdue_total": overdue_total,
        "overdue_invoices": overdue_invoices,
        "upcoming_total": upcoming_total,
        "upcoming_invoices": upcoming_invoices,
        # keep legacy field for any other consumers
        "due_total": overdue_total + upcoming_total,
        "due_invoices": all_unpaid,
    }


@router.get("")
def list_invoices(status: Optional[str] = None):
    conn = _conn()
    cur = conn.cursor()
    if status:
        cur.execute(
            "SELECT i.*, c.name as client_name FROM invoices i "
            "JOIN clients c ON i.client_id = c.id WHERE i.status = ? ORDER BY i.due_date DESC",
            (status,),
        )
    else:
        cur.execute(
            "SELECT i.*, c.name as client_name FROM invoices i "
            "JOIN clients c ON i.client_id = c.id ORDER BY i.due_date DESC"
        )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows
