"use client";
import { useEffect, useState, useCallback } from "react";
import PlaidLinkButton from "./components/PlaidLinkButton";

export default function Home() {
  const [items, setItems] = useState<any[]>([]);
  const [cashflows, setCashflows] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [schwabAccounts, setSchwabAccounts] = useState<any[]>([]);
  const [schwabStatus, setSchwabStatus] = useState<string>("idle");
  const [schwabAuthUrl, setSchwabAuthUrl] = useState<string | null>(null);
  const [schwabRedirectInput, setSchwabRedirectInput] = useState("");
  const [schwabCountdown, setSchwabCountdown] = useState<number | null>(null); // kept for type compat
  const [schwabSyncing, setSchwabSyncing] = useState(false);
  const [schwabSyncError, setSchwabSyncError] = useState<string | null>(null);
  const [schwabLastSynced, setSchwabLastSynced] = useState<string | null>(null);
  const [manualAccounts, setManualAccounts] = useState<any[]>([]);
  const [newManual, setNewManual] = useState({ name: "", account_type: "checking", balance: "" });
  const [editingManualId, setEditingManualId] = useState<number | null>(null);
  const [editingManualBalance, setEditingManualBalance] = useState("");
  const [projection, setProjection] = useState<any>(null);
  const [invoiceSummary, setInvoiceSummary] = useState<any>(null);
  const [newItem, setNewItem] = useState({ name: "", amount: "", is_income: false });
  const [newCashflow, setNewCashflow] = useState({ month: "", total_income: "", total_expense: "" });

  useEffect(() => {
    fetchItems();
    fetchCashflows();
    fetchAccounts();
    fetchSchwabAccounts();
    fetchManualAccounts();
    fetchProjection();
    fetchInvoiceSummary();
  }, []);

  const fetchProjection = async () => {
    try {
      const res = await fetch("/api/backend/projection/cashflow");
      if (res.ok) setProjection(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchInvoiceSummary = async () => {
    try {
      const res = await fetch("/api/backend/invoices/summary");
      if (res.ok) setInvoiceSummary(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchManualAccounts = async () => {
    try {
      const res = await fetch("/api/backend/manual-accounts/");
      if (res.ok) setManualAccounts(await res.json());
    } catch (e) { console.error(e); }
  };

  const addManualAccount = async (e: any) => {
    e.preventDefault();
    await fetch("/api/backend/manual-accounts/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newManual, balance: parseFloat(newManual.balance) }),
    });
    setNewManual({ name: "", account_type: "checking", balance: "" });
    fetchManualAccounts();
  };

  const updateManualBalance = async (id: number) => {
    await fetch(`/api/backend/manual-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance: parseFloat(editingManualBalance) }),
    });
    setEditingManualId(null);
    fetchManualAccounts();
    fetchProjection();
  };

  const deleteManualAccount = async (id: number) => {
    await fetch(`/api/backend/manual-accounts/${id}`, { method: "DELETE" });
    fetchManualAccounts();
  };

  const fetchSchwabAccounts = useCallback(async () => {
    try {
      const [statusRes, acctRes] = await Promise.all([
        fetch("/api/backend/schwab/status"),
        fetch("/api/backend/schwab/accounts"),
      ]);
      if (statusRes.ok) { const s = await statusRes.json(); setSchwabStatus(s.state); }
      if (acctRes.ok) setSchwabAccounts(await acctRes.json());
    } catch (e) { console.error("Error fetching Schwab accounts", e); }
  }, []);

  const connectSchwab = async () => {
    const res = await fetch("/api/backend/schwab/auth-url");
    const data = await res.json();
    setSchwabAuthUrl(data.auth_url);
    setSchwabStatus("awaiting_redirect");
    setSchwabCountdown(null);
    // Poll until connected
    const poll = setInterval(async () => {
      const s = await fetch("/api/backend/schwab/status").then(r => r.json());
      if (s.state === "connected") {
        clearInterval(poll);
        setSchwabStatus("connected");
        setSchwabAuthUrl(null);
      }
    }, 3000);
    // Stop polling after 5 min
    setTimeout(() => clearInterval(poll), 300000);
  };

  const startCountdown = () => {
    setSchwabCountdown(28);
    const interval = setInterval(() => {
      setSchwabCountdown(prev => {
        if (prev === null || prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const completeSchwabAuth = async () => {
    if (!schwabRedirectInput.trim()) return;
    setSchwabStatus("pending");
    const res = await fetch("/api/backend/schwab/complete-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redirect_url: schwabRedirectInput.trim() }),
    });
    if (res.ok) {
      setSchwabStatus("connected");
      setSchwabAuthUrl(null);
      setSchwabRedirectInput("");
      setSchwabCountdown(null);
    } else {
      const err = await res.json();
      const msg = err.detail?.toLowerCase() ?? "";
      if (msg.includes("expired") || msg.includes("bool")) {
        alert("The authorization code expired (30s limit). Click Connect Schwab and try again — paste the URL as fast as possible after authorizing.");
      } else {
        alert("Auth failed: " + err.detail);
      }
      setSchwabStatus("idle");
      setSchwabAuthUrl(null);
      setSchwabRedirectInput("");
      setSchwabCountdown(null);
    }
  };

  const syncSchwab = async () => {
    setSchwabSyncing(true);
    setSchwabSyncError(null);
    try {
      const res = await fetch("/api/backend/schwab/sync", { method: "POST" });
      if (res.ok) {
        setSchwabAccounts(await res.json());
        setSchwabLastSynced(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
      } else {
        const err = await res.json().catch(() => ({ detail: "Sync failed" }));
        if (res.status === 401) {
          setSchwabStatus("idle");
          setSchwabSyncError(null);
        } else {
          setSchwabSyncError(err.detail ?? "Sync failed");
        }
      }
    } catch (e) {
      setSchwabSyncError("Network error");
      console.error("Schwab sync error", e);
    } finally {
      setSchwabSyncing(false);
    }
  };

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/backend/plaid/accounts");
      if (res.ok) setAccounts(await res.json());
    } catch (e) { console.error("Error fetching accounts", e); }
  }, []);

  const syncBalances = async (institutionId: number) => {
    await fetch(`/api/backend/plaid/sync/${institutionId}`, { method: "POST" });
    fetchAccounts();
  };

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/backend/items/");
      if (res.ok) setItems(await res.json());
    } catch (e) { console.error("Error fetching items", e); }
  };

  const fetchCashflows = async () => {
    try {
      const res = await fetch("/api/backend/cashflow/");
      if (res.ok) setCashflows(await res.json());
    } catch (e) { console.error("Error fetching cashflows", e); }
  };

  const addItem = async (e: any) => {
    e.preventDefault();
    await fetch("/api/backend/items/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newItem.name, amount: parseFloat(newItem.amount), is_income: newItem.is_income }),
    });
    setNewItem({ name: "", amount: "", is_income: false });
    fetchItems();
  };

  const addCashflow = async (e: any) => {
    e.preventDefault();
    await fetch("/api/backend/cashflow/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: newCashflow.month, total_income: parseFloat(newCashflow.total_income), total_expense: parseFloat(newCashflow.total_expense) }),
    });
    setNewCashflow({ month: "", total_income: "", total_expense: "" });
    fetchCashflows();
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50 text-gray-900">
      <h1 className="text-3xl font-bold mb-8 text-center text-blue-600">Personal Finance Dashboard</h1>

      {/* 14-Day Cashflow Projection */}
      {projection && (
        <div className="max-w-6xl mx-auto mb-8">
          <section className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Cashflow Projection
                <span className="ml-2 text-sm font-normal text-gray-400">{projection.from_date} → {projection.to_date}</span>
              </h2>
              <button onClick={fetchProjection} className="text-xs text-blue-500 hover:text-blue-700">Refresh</button>
            </div>

            {/* Starting / Ending balance */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Starting Balance</p>
                <p className="text-lg font-bold text-gray-800 tabular-nums">
                  ${projection.starting_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-400 mt-1 truncate">
                  {projection.manual_accounts.map((a: any) => a.name).join(", ")}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Ending Balance</p>
                <p className={`text-lg font-bold tabular-nums ${projection.ending_balance < 0 ? "text-red-600" : "text-green-600"}`}>
                  ${projection.ending_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-400 mt-1">after payments</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                {(() => {
                  const net = projection.ending_balance - projection.starting_balance;
                  const isPositive = net >= 0;
                  return (
                    <>
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Net Change</p>
                      <p className={`text-lg font-bold tabular-nums ${isPositive ? "text-green-600" : "text-red-600"}`}>
                        {isPositive ? "+" : "-"}${Math.abs(net).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">through {new Date(projection.to_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Event timeline */}
            {projection.events.length === 0 ? (
              <p className="text-gray-400 text-sm">No scheduled payments in the next 14 days.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 text-xs uppercase border-b">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Item</th>
                    <th className="pb-2 text-right">Amount</th>
                    <th className="pb-2 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-dashed">
                    <td className="py-2 text-gray-400">Today</td>
                    <td className="py-2 text-gray-500">Starting balance</td>
                    <td className="py-2 text-right">—</td>
                    <td className="py-2 text-right font-semibold">
                      ${projection.starting_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  {projection.events.map((e: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 text-gray-500">{new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                      <td className="py-2 font-medium">{e.name}</td>
                      <td className={`py-2 text-right font-medium ${e.is_income ? "text-green-600" : "text-red-600"}`}>
                        {e.is_income ? "+" : "-"}${e.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`py-2 text-right font-bold ${e.balance_after < 0 ? "text-red-600" : "text-gray-800"}`}>
                        ${e.balance_after.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      {/* Schwab Brokerage Accounts */}
      <div className="max-w-6xl mx-auto mb-8">
        <section className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Schwab Brokerage</h2>
            <div className="flex gap-2 items-center">
              {schwabStatus === "connected" && (
                <>
                  {schwabLastSynced && !schwabSyncing && (
                    <span className="text-xs text-gray-400">synced {schwabLastSynced}</span>
                  )}
                  {schwabSyncError && (
                    <span className="text-xs text-red-500">{schwabSyncError}</span>
                  )}
                  <button
                    onClick={syncSchwab}
                    disabled={schwabSyncing}
                    className="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {schwabSyncing ? "Syncing…" : "Sync"}
                  </button>
                </>
              )}
              {(schwabStatus === "idle" || schwabStatus === "error") && (
                <button onClick={connectSchwab} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition text-sm">
                  Connect Schwab
                </button>
              )}
            </div>
          </div>

          {schwabStatus === "awaiting_redirect" && schwabAuthUrl && (
            <div className="space-y-3 mb-4 bg-purple-50 border border-purple-200 rounded p-4">
              <p className="text-sm text-gray-700">
                <a
                  href={schwabAuthUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-purple-700 underline font-semibold"
                >
                  Click here to log in to Schwab →
                </a>
              </p>
              <p className="text-sm text-gray-500">After you authorize, this page will update automatically. You can close the Schwab tab when done.</p>
            </div>
          )}

          {schwabStatus === "pending" && (
            <p className="text-sm text-purple-600">Completing authorization…</p>
          )}

          {schwabAccounts.length === 0 && !["awaiting_redirect","pending"].includes(schwabStatus) ? (
            <p className="text-gray-400 text-sm">No Schwab accounts connected yet.</p>
          ) : (
            <ul className="space-y-2">
              {schwabAccounts.map((acct: any) => (
                <li key={acct.id} className="flex justify-between items-center p-3 border-b text-sm">
                  <div>
                    <span className="font-medium">Schwab ···{acct.account_number_last4}</span>
                    <span className="ml-2 text-gray-400 capitalize">{acct.account_type?.toLowerCase()}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-green-600">
                      ${acct.liquid_value?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "—"}
                    </span>
                    {acct.cash_balance != null && (
                      <span className="block text-gray-400 text-xs">
                        ${acct.cash_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })} cash
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Bank Accounts */}
      <div className="max-w-6xl mx-auto mb-8">
        <section className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Bank &amp; Card Balances</h2>
            <PlaidLinkButton onSuccess={fetchAccounts} />
          </div>
          {accounts.length === 0 ? (
            <p className="text-gray-400 text-sm">No accounts linked yet. Click &quot;Connect a Bank&quot; to get started.</p>
          ) : (() => {
            const allAccounts = accounts.flatMap((i: any) => i.accounts);
            const creditTotal = allAccounts
              .filter((a: any) => a.type === "credit")
              .reduce((sum: number, a: any) => sum + (a.balance_statement ?? a.balance_current ?? 0), 0);
            return (
              <div className="space-y-6">
                {accounts.map((institution: any) => (
                  <div key={institution.id}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-700">{institution.institution_name}</h3>
                      <button onClick={() => syncBalances(institution.id)} className="text-xs text-blue-500 hover:text-blue-700">Sync</button>
                    </div>
                    <ul className="space-y-1">
                      {institution.accounts.map((acct: any) => {
                        const isCredit = acct.type === "credit";
                        const displayBalance = isCredit
                          ? (acct.balance_statement ?? acct.balance_current)
                          : acct.balance_current;
                        return (
                          <li key={acct.id} className="flex justify-between items-center p-2 border-b text-sm">
                            <div>
                              <span className="font-medium">{acct.official_name ?? acct.name}</span>
                              <span className="ml-2 text-gray-400 capitalize">{acct.subtype}</span>
                            </div>
                            <div className="text-right">
                              <span className={`font-bold ${isCredit ? "text-red-600" : "text-green-600"}`}>
                                ${displayBalance?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "—"}
                              </span>
                              {isCredit && acct.balance_statement != null && (
                                <span className="block text-gray-400 text-xs">stmt balance</span>
                              )}
                              {!isCredit && acct.balance_available != null && acct.balance_available !== acct.balance_current && (
                                <span className="block text-gray-400 text-xs">
                                  ${acct.balance_available.toLocaleString("en-US", { minimumFractionDigits: 2 })} avail
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200">
                  <span className="font-semibold text-gray-700">Total Credit Card Balance</span>
                  <span className="font-bold text-red-600 text-lg">
                    ${creditTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            );
          })()}
        </section>
      </div>

      {/* Manual Accounts */}
      <div className="max-w-6xl mx-auto mb-8">
        <section className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Manual Accounts</h2>
          <form onSubmit={addManualAccount} className="flex gap-2 mb-4 flex-wrap">
            <input
              type="text"
              placeholder="Account name"
              value={newManual.name}
              onChange={e => setNewManual({...newManual, name: e.target.value})}
              className="border p-2 rounded text-sm flex-1 min-w-32"
              required
            />
            <select
              value={newManual.account_type}
              onChange={e => setNewManual({...newManual, account_type: e.target.value})}
              className="border p-2 rounded text-sm"
            >
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
            <input
              type="number"
              placeholder="Balance"
              value={newManual.balance}
              onChange={e => setNewManual({...newManual, balance: e.target.value})}
              className="border p-2 rounded text-sm w-32"
              step="0.01"
              required
            />
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm">Add</button>
          </form>
          {manualAccounts.length === 0 ? (
            <p className="text-gray-400 text-sm">No manual accounts yet.</p>
          ) : (
            <ul className="space-y-1">
              {manualAccounts.map((acct: any) => (
                <li key={acct.id} className="flex justify-between items-center p-2 border-b text-sm">
                  <div>
                    <span className="font-medium">{acct.name}</span>
                    <span className="ml-2 text-gray-400 capitalize">{acct.account_type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {editingManualId === acct.id ? (
                      <>
                        <input
                          type="number"
                          value={editingManualBalance}
                          onChange={e => setEditingManualBalance(e.target.value)}
                          className="border p-1 rounded text-sm w-28 text-right"
                          step="0.01"
                          autoFocus
                        />
                        <button onClick={() => updateManualBalance(acct.id)} className="text-green-600 text-xs font-medium">Save</button>
                        <button onClick={() => setEditingManualId(null)} className="text-gray-400 text-xs">Cancel</button>
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-green-600">
                          ${acct.balance?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                        <button
                          onClick={() => { setEditingManualId(acct.id); setEditingManualBalance(acct.balance.toString()); }}
                          className="text-xs text-blue-500 hover:text-blue-700"
                        >
                          Edit
                        </button>
                        <button onClick={() => deleteManualAccount(acct.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Invoices */}
      {invoiceSummary && (
        <div className="max-w-6xl mx-auto mb-8">
          <section className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Invoices</h2>

            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Unbilled</p>
                <p className="text-lg font-bold text-blue-600 tabular-nums">
                  ${invoiceSummary.unbilled_total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-400 mt-1">hours not yet invoiced</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Overdue</p>
                <p className="text-lg font-bold text-red-600 tabular-nums">
                  ${(invoiceSummary.overdue_total ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-400 mt-1">{(invoiceSummary.overdue_invoices ?? []).length} invoice{(invoiceSummary.overdue_invoices ?? []).length !== 1 ? "s" : ""}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Upcoming</p>
                <p className="text-lg font-bold text-orange-500 tabular-nums">
                  ${(invoiceSummary.upcoming_total ?? invoiceSummary.due_total).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-400 mt-1">{(invoiceSummary.upcoming_invoices ?? invoiceSummary.due_invoices ?? []).length} invoice{(invoiceSummary.upcoming_invoices ?? invoiceSummary.due_invoices ?? []).length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {/* Invoice list — overdue first, then upcoming */}
            {invoiceSummary.due_invoices.length > 0 && (
              <ul className="space-y-1">
                {invoiceSummary.due_invoices.map((inv: any) => {
                  const isOverdue = new Date(inv.due_date) < new Date(new Date().toDateString());
                  return (
                    <li key={inv.id} className="flex justify-between items-center p-2 border-b text-sm">
                      <div>
                        <span className="font-medium">{inv.invoice_number}</span>
                        <span className="ml-2 text-gray-500">{inv.client_name}</span>
                        <span className={`ml-2 text-xs ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                          {isOverdue ? "overdue since" : "due"} {inv.due_date}
                        </span>
                      </div>
                      <span className={`font-bold ${isOverdue ? "text-red-600" : "text-orange-500"}`}>
                        ${inv.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
        <section className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Recurring Items</h2>
          <form onSubmit={addItem} className="mb-4 flex flex-col gap-2">
            <input type="text" placeholder="Name" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="border p-2 rounded" required />
            <input type="number" placeholder="Amount" value={newItem.amount} onChange={e => setNewItem({...newItem, amount: e.target.value})} className="border p-2 rounded" required />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={newItem.is_income} onChange={e => setNewItem({...newItem, is_income: e.target.checked})} />
              Is Income?
            </label>
            <button type="submit" className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition">Add Item</button>
          </form>
          <ul className="space-y-2">
            {items.map(item => (
              <li key={item.id} className="flex justify-between p-2 border-b">
                <span>{item.name}</span>
                <span className={item.is_income ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                  {item.is_income ? "+" : "-"}${item.amount}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Monthly Cashflow</h2>
          <form onSubmit={addCashflow} className="mb-4 flex flex-col gap-2">
            <input type="text" placeholder="Month (e.g., Jan 2024)" value={newCashflow.month} onChange={e => setNewCashflow({...newCashflow, month: e.target.value})} className="border p-2 rounded" required />
            <input type="number" placeholder="Total Income" value={newCashflow.total_income} onChange={e => setNewCashflow({...newCashflow, total_income: e.target.value})} className="border p-2 rounded" required />
            <input type="number" placeholder="Total Expense" value={newCashflow.total_expense} onChange={e => setNewCashflow({...newCashflow, total_expense: e.target.value})} className="border p-2 rounded" required />
            <button type="submit" className="bg-green-500 text-white p-2 rounded hover:bg-green-600 transition">Add Cashflow</button>
          </form>
          <ul className="space-y-2">
            {cashflows.map(cf => (
              <li key={cf.id} className="flex justify-between p-2 border-b">
                <span className="font-semibold">{cf.month}</span>
                <span className="text-green-600">+${cf.total_income}</span>
                <span className="text-red-600">-${cf.total_expense}</span>
                <span className="text-gray-600 font-bold">Net: ${(cf.total_income - cf.total_expense).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
