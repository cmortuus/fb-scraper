"use client";

import { useState, useEffect, useCallback } from "react";
import type { Deal, SavedSearch } from "@/app/lib/microcenter";
import { STORES, DEFAULT_STORE_IDS } from "@/app/lib/microcenter";

// Stores shown in the quick-select area (others still available via saved searches)
const QUICK_STORES = {
  "Rockville, MD": "085",
  "Parkville, MD": "151",
  "Fairfax, VA": "164",
};

export default function MicroCenterPage() {
  const [selectedStores, setSelectedStores] = useState<string[]>(DEFAULT_STORE_IDS);
  const [minSavings, setMinSavings] = useState(20);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [rawCount, setRawCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  // Save search form
  const [saveName, setSaveName] = useState("");
  const [saveEmail, setSaveEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Saved searches
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<Record<string, string>>({});

  const loadSaved = useCallback(async () => {
    const res = await fetch("/api/microcenter/saved");
    setSavedSearches(await res.json());
  }, []);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  function toggleStore(id: string) {
    setSelectedStores((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function scan() {
    if (selectedStores.length === 0) return;
    setLoading(true);
    setError(null);
    setDeals([]);
    setRawCount(null);
    try {
      const params = new URLSearchParams({
        storeIds: selectedStores.join(","),
        minSavings: String(minSavings),
      });
      const res = await fetch(`/api/microcenter?${params}`);
      const data = await res.json();
      if (data.error && !data.deals?.length) setError(data.error);
      else {
        setDeals(data.deals ?? []);
        setRawCount(data.rawCount ?? null);
        setLastChecked(new Date().toLocaleTimeString());
      }
    } catch {
      setError("Failed to reach server");
    } finally {
      setLoading(false);
    }
  }

  async function saveSearch() {
    if (!saveName || !saveEmail) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/microcenter/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName,
          storeIds: selectedStores,
          minSavings,
          email: saveEmail,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error ?? "Failed to save search");
      } else {
        setSaveName("");
        setSaveEmail("");
        loadSaved();
      }
    } catch {
      setSaveError("Failed to reach server");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSearch(id: string) {
    if (!window.confirm("Delete this saved search?")) return;
    const res = await fetch(`/api/microcenter/saved?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to delete search");
      return;
    }
    loadSaved();
  }

  async function runSearch(s: SavedSearch) {
    setRunningId(s.id);
    setRunStatus((prev) => ({ ...prev, [s.id]: "Running..." }));
    try {
      const res = await fetch(`/api/microcenter/saved/run?id=${s.id}`, { method: "POST" });
      const data = await res.json();
      if (data.error) setRunStatus((prev) => ({ ...prev, [s.id]: `Error: ${data.error}` }));
      else if (!data.sent) setRunStatus((prev) => ({ ...prev, [s.id]: data.message ?? "No deals found" }));
      else setRunStatus((prev) => ({ ...prev, [s.id]: `Emailed ${data.dealsFound} deal${data.dealsFound !== 1 ? "s" : ""}` }));
    } catch {
      setRunStatus((prev) => ({ ...prev, [s.id]: "Failed" }));
    } finally {
      setRunningId(null);
      loadSaved();
    }
  }

  const worthItDeals = deals.filter((d) => d.worthIt);
  const otherDeals = deals.filter((d) => !d.worthIt);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100 mb-1">MicroCenter Open Box</h1>
        <p className="text-gray-400 text-sm">Scans open box inventory across stores and finds deals with the best savings ratio. Filters out cables and low-value items.</p>
      </div>

      {/* Controls */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <p className="text-xs font-medium text-gray-400 mb-2">Stores</p>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(QUICK_STORES).map(([name, id]) => (
                <label key={id} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedStores.includes(id)}
                    onChange={() => toggleStore(id)}
                    className="w-4 h-4 rounded accent-indigo-500"
                  />
                  <span className="text-sm text-gray-200">{name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-400">Min savings %</label>
            <input
              type="number"
              value={minSavings}
              min={5}
              max={90}
              onChange={(e) => setMinSavings(Number(e.target.value))}
              className="border border-gray-700 bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={scan}
            disabled={loading || selectedStores.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:text-indigo-400 text-white font-semibold px-6 py-2 rounded-lg transition-colors text-sm h-fit"
          >
            {loading ? "Scanning..." : "Scan Deals"}
          </button>

          {lastChecked && !loading && (
            <span className="text-xs text-gray-500 self-center">Checked {lastChecked}</span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 mb-4 text-red-300 text-sm">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
          <div className="w-10 h-10 border-4 border-indigo-900 border-t-indigo-400 rounded-full animate-spin" />
          <p className="font-medium">Scanning {selectedStores.length} store{selectedStores.length > 1 ? "s" : ""}...</p>
          <p className="text-sm text-gray-500">Takes ~15–30s per store</p>
        </div>
      )}

      {/* Results */}
      {!loading && deals.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-400">
              {rawCount !== null && `${rawCount} open box items scanned · `}
              <span className="font-semibold text-gray-100">{worthItDeals.length} worth it</span>
              {otherDeals.length > 0 && ` · ${otherDeals.length} filtered out`}
            </p>
          </div>

          {worthItDeals.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {worthItDeals.map((deal, i) => (
                <DealCard key={i} deal={deal} />
              ))}
            </div>
          )}

          {otherDeals.length > 0 && (
            <details className="mt-2">
              <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-300 mb-3">
                Show {otherDeals.length} filtered-out items
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3 opacity-60">
                {otherDeals.map((deal, i) => (
                  <DealCard key={i} deal={deal} />
                ))}
              </div>
            </details>
          )}

          {worthItDeals.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No deals met the criteria. Try lowering the min savings % or check back later.
            </div>
          )}
        </div>
      )}

      {/* Save search */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 mb-6">
        <p className="text-sm font-semibold text-gray-200 mb-1">Save this search for email alerts</p>
        <p className="text-xs text-gray-400 mb-3">
          Saves the current store selection + savings threshold. Run manually or schedule with cron.
        </p>
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search name (e.g. GPU deals)"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            className="border border-gray-700 rounded-lg px-3 py-2 text-sm flex-1 min-w-40 bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="email"
            placeholder="your@email.com"
            value={saveEmail}
            onChange={(e) => setSaveEmail(e.target.value)}
            className="border border-gray-700 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={saveSearch}
            disabled={!saveName || !saveEmail || saving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm whitespace-nowrap"
          >
            {saving ? "Saving..." : "Save Search"}
          </button>
        </div>
        {saveError && (
          <p className="mt-2 text-xs text-red-400">{saveError}</p>
        )}
        <p className="text-xs text-gray-500 mt-3">
          Requires <code className="bg-gray-800 px-1 rounded">GMAIL_USER</code> + <code className="bg-gray-800 px-1 rounded">GMAIL_APP_PASSWORD</code> in <code className="bg-gray-800 px-1 rounded">.env.local</code> to send email.
          For daily alerts: <code className="bg-gray-800 px-1 rounded text-[11px]">crontab -e</code> → add <code className="bg-gray-800 px-1 rounded text-[11px]">0 9 * * * curl -s -X POST http://localhost:3000/api/microcenter/saved/run?id=SEARCH_ID</code>
        </p>
      </div>

      {/* Saved searches */}
      {savedSearches.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-200 mb-3">Saved Searches</h2>
          <div className="flex flex-col gap-3">
            {savedSearches.map((s) => (
              <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-100 text-sm">{s.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.storeIds.map((id) => Object.entries(STORES).find(([, v]) => v === id)?.[0] ?? id).join(", ")} · min {s.minSavings}% savings · {s.email}
                  </p>
                  {s.lastRun && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Last run: {new Date(s.lastRun).toLocaleString()} · {s.lastDealsFound ?? 0} deal{s.lastDealsFound !== 1 ? "s" : ""} found
                    </p>
                  )}
                  {runStatus[s.id] && (
                    <p className="text-xs text-indigo-400 mt-1 font-medium">{runStatus[s.id]}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => runSearch(s)}
                    disabled={runningId === s.id}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:text-indigo-400 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
                  >
                    {runningId === s.id ? "Running..." : "Run & Email"}
                  </button>
                  <button
                    onClick={() => deleteSearch(s.id)}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded-lg hover:bg-red-900/30 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  return (
    <a
      href={deal.url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:shadow-md hover:border-gray-700 transition-shadow flex flex-col"
    >
      {deal.imageUrl && (
        <div className="aspect-video bg-gray-800 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={deal.imageUrl} alt={deal.title} className="w-full h-full object-contain p-2" />
        </div>
      )}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <p className="text-sm font-semibold text-gray-100 leading-snug line-clamp-2">{deal.title}</p>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xl font-bold text-green-400">${deal.openBoxPrice}</span>
          {deal.originalPrice && (
            <span className="text-sm text-gray-500 line-through">${deal.originalPrice}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {deal.savingsPercent !== null && (
            <span className="bg-green-900/40 text-green-300 text-xs font-bold px-2 py-0.5 rounded-full">
              {deal.savingsPercent}% off{deal.savingsAmount ? ` · save $${deal.savingsAmount}` : ""}
            </span>
          )}
          <span className="text-xs text-gray-500">{deal.store}</span>
        </div>
      </div>
    </a>
  );
}
