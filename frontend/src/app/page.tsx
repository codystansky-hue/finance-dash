"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [items, setItems] = useState<any[]>([]);
  const [cashflows, setCashflows] = useState<any[]>([]);
  const [newItem, setNewItem] = useState({ name: "", amount: "", is_income: false });
  const [newCashflow, setNewCashflow] = useState({ month: "", total_income: "", total_expense: "" });

  useEffect(() => {
    fetchItems();
    fetchCashflows();
  }, []);

  const fetchItems = async () => {
    try {
      const res = await fetch("http://192.168.1.197:8000/api/items/");
      if (res.ok) setItems(await res.json());
    } catch (e) { console.error("Error fetching items", e); }
  };

  const fetchCashflows = async () => {
    try {
      const res = await fetch("http://192.168.1.197:8000/api/cashflow/");
      if (res.ok) setCashflows(await res.json());
    } catch (e) { console.error("Error fetching cashflows", e); }
  };

  const addItem = async (e: any) => {
    e.preventDefault();
    await fetch("http://192.168.1.197:8000/api/items/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newItem.name, amount: parseFloat(newItem.amount), is_income: newItem.is_income }),
    });
    setNewItem({ name: "", amount: "", is_income: false });
    fetchItems();
  };

  const addCashflow = async (e: any) => {
    e.preventDefault();
    await fetch("http://192.168.1.197:8000/api/cashflow/", {
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
