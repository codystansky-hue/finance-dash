import os
import ssl
import threading
import urllib.parse
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from typing import List, Optional

from .. import models, schemas
from ..database import get_db

load_dotenv()

SCHWAB_APP_KEY = os.getenv("SCHWAB_APP_KEY")
SCHWAB_APP_SECRET = os.getenv("SCHWAB_APP_SECRET")
SCHWAB_CALLBACK = "https://127.0.0.1:8443/api/schwab/callback"

_client = None
_auth_event = threading.Event()
_auth_code: Optional[str] = None
_auth_error: Optional[str] = None

router = APIRouter(prefix="/api/schwab", tags=["schwab"])

_CERT_DIR = Path(__file__).parent.parent.parent  # backend/


# ── HTTPS callback server on port 8443 ────────────────────────────────────────

class _CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global _auth_code, _auth_error
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        code = params.get("code", [None])[0]
        error = params.get("error", [None])[0]

        if error:
            _auth_error = error
            _auth_event.set()
            body = b"<html><body><h2>Authorization failed.</h2><p>You can close this tab.</p></body></html>"
        elif code:
            _auth_code = urllib.parse.unquote(code)
            _auth_event.set()
            body = b"<html><body style='font-family:sans-serif;text-align:center;padding:60px'><h2>Schwab Connected!</h2><p>You can close this tab and return to the dashboard.</p></body></html>"
        else:
            body = b"<html><body><h2>No authorization code received.</h2></body></html>"

        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass  # suppress access logs


class _ReuseAddrHTTPServer(HTTPServer):
    allow_reuse_address = True


def _start_https_callback_server():
    certfile = _CERT_DIR / "127.0.0.1.crt"
    keyfile = _CERT_DIR / "127.0.0.1.key"
    if not certfile.exists() or not keyfile.exists():
        print("[schwab] SSL certs not found — HTTPS callback server not started")
        return
    try:
        server = _ReuseAddrHTTPServer(("127.0.0.1", 8443), _CallbackHandler)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(str(certfile), str(keyfile))
        server.socket = ctx.wrap_socket(server.socket, server_side=True)
        print("[schwab] HTTPS callback server listening on https://127.0.0.1:8443")
        server.serve_forever()
    except OSError as e:
        print(f"[schwab] HTTPS callback server failed (port 8443 in use?): {e}")
    except Exception as e:
        print(f"[schwab] HTTPS callback server error: {e}")


def start_callback_server():
    """Call this once at app startup."""
    threading.Thread(target=_start_https_callback_server, daemon=True).start()


# ── Schwab client helpers ──────────────────────────────────────────────────────

def _no_browser_auth(url: str) -> str:
    """Passed as call_on_auth to prevent schwabdev from opening a browser."""
    raise Exception("Token refresh required — use /api/schwab/auth-url to reconnect")


def _load_client():
    """Load the Schwab client from saved tokens without triggering a browser open."""
    global _client
    if _client is not None:
        return _client
    try:
        import schwabdev
        c = schwabdev.Client(
            SCHWAB_APP_KEY, SCHWAB_APP_SECRET,
            callback_url=SCHWAB_CALLBACK,
            call_on_auth=_no_browser_auth,
        )
        _client = c
        return _client
    except Exception:
        return None


def _do_auth():
    global _client, _auth_code, _auth_error
    _auth_event.clear()

    def _call_for_auth(auth_url: str) -> str:
        _auth_event.wait(timeout=300)
        if _auth_code:
            return f"{SCHWAB_CALLBACK}?code={urllib.parse.quote(_auth_code)}&session=auto"
        raise Exception(_auth_error or "Auth timed out")

    try:
        import schwabdev
        _client = schwabdev.Client(
            SCHWAB_APP_KEY, SCHWAB_APP_SECRET,
            callback_url=SCHWAB_CALLBACK,
            call_on_auth=_call_for_auth,
        )
    except Exception as e:
        _auth_error = str(e)


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/status")
def auth_status():
    if _client is not None:
        return {"state": "connected"}
    # Try loading from saved tokens — _no_browser_auth raises immediately if expired,
    # so this is a fast local check with no network calls or browser prompts.
    if _load_client() is not None:
        return {"state": "connected"}
    return {"state": "idle"}


@router.get("/auth-url")
def get_auth_url():
    global _auth_code, _auth_error
    if not SCHWAB_APP_KEY or not SCHWAB_APP_SECRET:
        raise HTTPException(status_code=503, detail="SCHWAB_APP_KEY and SCHWAB_APP_SECRET not configured")
    _auth_code = None
    _auth_error = None
    auth_url = (
        f"https://api.schwabapi.com/v1/oauth/authorize"
        f"?client_id={SCHWAB_APP_KEY}&redirect_uri={urllib.parse.quote(SCHWAB_CALLBACK, safe='')}"
    )
    threading.Thread(target=_do_auth, daemon=True).start()
    return {"auth_url": auth_url}


@router.post("/sync", response_model=List[schemas.SchwabAccount])
def sync_accounts(db: Session = Depends(get_db)):
    client = _client or _load_client()
    if not client:
        raise HTTPException(status_code=401, detail="Schwab token expired — click Connect Schwab to re-authenticate.")

    try:
        resp = client.account_details_all(fields="positions")
        linked = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Schwab API error: {e}")

    if not isinstance(linked, list):
        raise HTTPException(status_code=502, detail=f"Unexpected Schwab response: {linked}")

    now = datetime.now(timezone.utc).isoformat()
    results = []
    for entry in linked:
        sec = entry.get("securitiesAccount", {})
        account_hash = sec.get("accountNumber", "")
        last4 = account_hash[-4:] if len(account_hash) >= 4 else account_hash
        balances = sec.get("currentBalances", {})

        data = dict(
            account_number_last4=last4,
            account_type=sec.get("type", ""),
            liquid_value=balances.get("liquidationValue"),
            cash_balance=balances.get("cashBalance"),
            long_market_value=balances.get("longMarketValue"),
            day_pnl=balances.get("currentDayProfitLoss"),
            last_synced=now,
        )
        existing = db.query(models.SchwabAccount).filter_by(account_hash=account_hash).first()
        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
        else:
            existing = models.SchwabAccount(account_hash=account_hash, **data)
            db.add(existing)
        db.commit()
        db.refresh(existing)
        results.append(existing)

    return results


@router.get("/accounts", response_model=List[schemas.SchwabAccount])
def get_accounts(db: Session = Depends(get_db)):
    return db.query(models.SchwabAccount).all()
