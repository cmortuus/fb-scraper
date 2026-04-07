"use client";

import { useState } from "react";
import ParsedParamsChips from "./components/ParsedParamsChips";
import ResultsGrid from "./components/ResultsGrid";
import type { Listing, SearchParams } from "./lib/types";
import { CITY_TO_CL } from "./lib/cities";

type Source = "all" | "craigslist" | "ebay" | "facebook";

const EXAMPLE_SEARCHES = [
  "Used Honda Civic under $12,000 in Seattle, good condition",
  "Squat rack or power cage under $400 near Denver",
  "Trek mountain bike, any condition, under $600 in Austin",
  "Vintage leather couch or sofa under $300 in Chicago",
];

function buildCraigslistUrl(params: SearchParams): string {
  const locationKey = (params.location ?? "").toLowerCase().trim();
  const q = new URLSearchParams({ query: params.keywords });
  if (params.minPrice) q.set("min_price", String(params.minPrice));
  if (params.maxPrice) q.set("max_price", String(params.maxPrice));
  if (params.radiusMiles) q.set("search_distance", String(params.radiusMiles));
  if (!locationKey) {
    // No location — use Craigslist's national search
    return `https://www.craigslist.org/search/${params.craigslistCategory}?${q.toString()}`;
  }
  const subdomain = CITY_TO_CL[locationKey] ?? locationKey.replace(/\s+/g, "");
  return `https://${subdomain}.craigslist.org/search/${params.craigslistCategory}?${q.toString()}`;
}

export default function Home() {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useState<SearchParams | null>(null);
  const [categoryLabel, setCategoryLabel] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [rawCount, setRawCount] = useState(0);
  const [filterFailed, setFilterFailed] = useState(false);
  const [clUrl, setClUrl] = useState("");
  const [activeSource, setActiveSource] = useState<Source>("all");
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;

    setLoading(true);
    setError(null);
    setSearchParams(null);
    setListings([]);
    setRawCount(0);
    setFilterFailed(false);
    setSourceErrors([]);
    setActiveSource("all");

    try {
      // Step 1: Parse with Claude
      setLoadingStep("Understanding your search...");
      const parseRes = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!parseRes.ok) throw new Error("Failed to parse description");
      const { params, categoryLabel: label } = await parseRes.json() as {
        params: SearchParams;
        categoryLabel: string;
      };
      setSearchParams(params);
      setCategoryLabel(label);
      setClUrl(buildCraigslistUrl(params));

      // Step 2: Fetch eBay + Facebook Marketplace in parallel
      setLoadingStep("Searching eBay & Facebook Marketplace...");

      const ebayParams = new URLSearchParams({
        keywords: params.keywords,
        categoryId: params.ebayCategoryId,
        ...(params.minPrice ? { minPrice: String(params.minPrice) } : {}),
        ...(params.maxPrice ? { maxPrice: String(params.maxPrice) } : {}),
      });

      const fbParams = new URLSearchParams({
        keywords: params.keywords,
        ...(params.minPrice ? { minPrice: String(params.minPrice) } : {}),
        ...(params.maxPrice ? { maxPrice: String(params.maxPrice) } : {}),
        ...(params.location ? { location: params.location } : {}),
        ...(params.radiusMiles ? { radiusMiles: String(params.radiusMiles) } : {}),
      });

      const [ebayResult, fbResult] = await Promise.allSettled([
        fetch(`/api/search/ebay?${ebayParams}`).then((r) => r.json()),
        fetch(`/api/search/facebook?${fbParams}`).then((r) => r.json()),
      ]);

      const allListings: Listing[] = [];
      const errors: string[] = [];

      if (ebayResult.status === "fulfilled") {
        if (ebayResult.value.error) errors.push(`eBay: ${ebayResult.value.error}`);
        allListings.push(...(ebayResult.value.listings ?? []));
      } else {
        errors.push("eBay: failed to fetch");
      }

      if (fbResult.status === "fulfilled") {
        if (fbResult.value.error) errors.push(`Facebook: ${fbResult.value.error}`);
        allListings.push(...(fbResult.value.listings ?? []));
      } else {
        errors.push("Facebook Marketplace: failed to fetch");
      }

      // Step 3: Filter for relevance with Claude
      setLoadingStep("Filtering relevant results...");
      setRawCount(allListings.length);
      let relevantListings = allListings;
      if (allListings.length > 0) {
        try {
          const filterRes = await fetch("/api/filter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listings: allListings, description }),
          });
          if (filterRes.ok) {
            const data = await filterRes.json();
            relevantListings = data.listings;
            if (data.filterFailed) setFilterFailed(true);
          } else {
            setFilterFailed(true);
          }
        } catch {
          setFilterFailed(true);
        }
      }

      // Sort by price ascending, nulls last
      relevantListings.sort((a, b) => {
        if (a.price == null && b.price == null) return 0;
        if (a.price == null) return 1;
        if (b.price == null) return -1;
        return a.price - b.price;
      });

      setListings(relevantListings);
      setSourceErrors(errors);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  }

  const counts: Record<Source, number> = {
    all: listings.length,
    ebay: listings.filter((l) => l.source === "ebay").length,
    facebook: listings.filter((l) => l.source === "facebook").length,
    craigslist: 0,
  };

  const sourceTabs: { key: Source; label: string }[] = [
    { key: "all", label: "All" },
    { key: "ebay", label: "eBay" },
    { key: "facebook", label: "Facebook Marketplace" },
  ];

  const filtered = activeSource === "all"
    ? listings
    : listings.filter((l) => l.source === activeSource);

  return (
    <main className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🔍</span>
            <h1 className="text-2xl font-bold text-gray-100">Used Finder</h1>
          </div>
          <p className="text-gray-400 text-sm ml-11">
            Describe what you&apos;re looking for — searches eBay & Facebook Marketplace inline, Craigslist via link.
          </p>

          <form onSubmit={handleSearch} className="mt-5">
            <div className="flex gap-3">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Used squat rack under $300 near Seattle, decent condition"
                rows={2}
                className="flex-1 resize-none rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSearch(e as unknown as React.FormEvent);
                  }
                }}
              />
              <button
                type="submit"
                disabled={loading || !description.trim()}
                className="self-end px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
          </form>

          {!searchParams && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-gray-500 self-center">Try:</span>
              {EXAMPLE_SEARCHES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setDescription(ex)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-950 hover:bg-indigo-900 px-3 py-1 rounded-full transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          {searchParams && (
            <ParsedParamsChips params={searchParams} categoryLabel={categoryLabel} />
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading && (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-4 border-indigo-900 border-t-indigo-400 rounded-full animate-spin mb-4" />
            <p className="text-gray-400">{loadingStep}</p>
            {loadingStep.includes("Facebook") && (
              <p className="text-xs text-gray-500 mt-2">Facebook takes ~10s (launching browser)</p>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {sourceErrors.length > 0 && (
          <div className="mb-4 space-y-1">
            {sourceErrors.map((e) => (
              <div key={e} className="text-xs text-amber-400 bg-amber-900/30 border border-amber-800 rounded-lg px-3 py-2">
                ⚠️ {e}
              </div>
            ))}
          </div>
        )}

        {filterFailed && !loading && (
          <div className="mb-4 text-xs text-amber-400 bg-amber-900/30 border border-amber-800 rounded-lg px-3 py-2">
            ⚠️ Relevance filtering unavailable — showing all {rawCount} raw results
          </div>
        )}

{!loading && searchParams && (
          <>
            {/* Source tabs */}
            {listings.length > 0 && (
              <div className="flex gap-1 mb-5 border-b border-gray-800">
                {sourceTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveSource(tab.key)}
                    className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                      activeSource === tab.key
                        ? "border-indigo-400 text-indigo-400"
                        : "border-transparent text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {tab.label}
                    <span className="ml-1.5 text-xs text-gray-500">({counts[tab.key]})</span>
                  </button>
                ))}
              </div>
            )}

            {/* Listing cards */}
            {filtered.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((listing) => (
                  <a
                    key={listing.id}
                    href={listing.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col bg-gray-900 rounded-2xl shadow-sm border border-gray-800 hover:shadow-md hover:border-gray-700 transition-all overflow-hidden"
                  >
                    <div className="h-44 bg-gray-800 flex items-center justify-center overflow-hidden">
                      {listing.imageUrl ? (
                        <img
                          src={listing.imageUrl}
                          alt={listing.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <span className="text-4xl text-gray-600">📦</span>
                      )}
                    </div>
                    <div className="p-4 flex flex-col gap-2 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-100 line-clamp-2 leading-snug flex-1">
                          {listing.title}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                          listing.source === "ebay"
                            ? "bg-yellow-900/40 text-yellow-300"
                            : "bg-blue-900/40 text-blue-300"
                        }`}>
                          {listing.source === "ebay" ? "eBay" : "Facebook"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-2">
                        <span className="text-lg font-bold text-gray-100">
                          {listing.price != null ? `$${listing.price.toLocaleString()}` : "Price N/A"}
                        </span>
                        <span className="text-xs text-gray-500">{listing.location}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500">
                {rawCount > 0 && !filterFailed
                  ? <p>{rawCount} listing{rawCount !== 1 ? "s" : ""} found, but none matched your criteria after filtering. Try broadening your search.</p>
                  : <p>No results found. Try broadening your search or a different location.</p>
                }
              </div>
            )}

            {/* Craigslist link-out (can't scrape) */}
            {clUrl && (
              <div className="mt-8">
                <a
                  href={clUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-2xl px-6 py-4 hover:border-indigo-600 hover:shadow-md transition-all"
                >
                  <span className="text-2xl">🏷️</span>
                  <div>
                    <p className="font-semibold text-gray-100">Craigslist</p>
                    <p className="text-sm text-gray-500">Open pre-filled search (blocks automated access) ↗</p>
                  </div>
                </a>
              </div>
            )}
          </>
        )}

        {!loading && !searchParams && (
          <div className="text-center py-20">
            <div className="text-7xl mb-4">🛒</div>
            <p className="text-xl font-medium text-gray-500">Describe what you&apos;re looking for above</p>
            <p className="text-sm mt-2 text-gray-600">Searches eBay & Facebook Marketplace inline</p>
          </div>
        )}
      </div>
    </main>
  );
}
