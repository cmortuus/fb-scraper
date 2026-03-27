"use client";

import { useState } from "react";
import ParsedParamsChips from "./components/ParsedParamsChips";
import ResultsGrid from "./components/ResultsGrid";
import type { Listing, SearchParams } from "./lib/types";

type Source = "all" | "craigslist" | "ebay" | "facebook";

const EXAMPLE_SEARCHES = [
  "Used Honda Civic under $12,000 in Seattle, good condition",
  "Squat rack or power cage under $400 near Denver",
  "Trek mountain bike, any condition, under $600 in Austin",
  "Vintage leather couch or sofa under $300 in Chicago",
];

// Maps common city names to Craigslist subdomains
const CITY_TO_CL: Record<string, string> = {
  "new york": "newyork", "nyc": "newyork", "los angeles": "losangeles", "la": "losangeles",
  "san francisco": "sfbay", "sf": "sfbay", "bay area": "sfbay", "chicago": "chicago",
  "seattle": "seattle", "denver": "denver", "dallas": "dallas", "houston": "houston",
  "phoenix": "phoenix", "portland": "portland", "austin": "austin", "miami": "miami",
  "atlanta": "atlanta", "boston": "boston", "minneapolis": "minneapolis",
  "san diego": "sandiego", "las vegas": "lasvegas", "detroit": "detroit",
  "philadelphia": "philadelphia", "nashville": "nashville", "sacramento": "sacramento",
  "raleigh": "raleigh", "tampa": "tampa", "orlando": "orlando", "pittsburgh": "pittsburgh",
  "kansas city": "kansascity", "salt lake city": "saltlakecity", "slc": "saltlakecity",
};

function buildCraigslistUrl(params: SearchParams): string {
  const locationKey = (params.location ?? "").toLowerCase().trim();
  const subdomain = (CITY_TO_CL[locationKey] ?? locationKey.replace(/\s+/g, "")) || "sfbay";
  const q = new URLSearchParams({ query: params.keywords });
  if (params.minPrice) q.set("min_price", String(params.minPrice));
  if (params.maxPrice) q.set("max_price", String(params.maxPrice));
  if (params.radiusMiles) q.set("search_distance", String(params.radiusMiles));
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
      let relevantListings = allListings;
      if (allListings.length > 0) {
        try {
          const filterRes = await fetch("/api/filter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listings: allListings, description }),
          });
          if (filterRes.ok) {
            const { listings: filtered } = await filterRes.json();
            relevantListings = filtered;
          }
        } catch {
          // fallback: show all results
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
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🔍</span>
            <h1 className="text-2xl font-bold text-gray-900">Used Finder</h1>
          </div>
          <p className="text-gray-500 text-sm ml-11">
            Describe what you&apos;re looking for — searches eBay & Facebook Marketplace inline, Craigslist via link.
          </p>

          <form onSubmit={handleSearch} className="mt-5">
            <div className="flex gap-3">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Used squat rack under $300 near Seattle, decent condition"
                rows={2}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent shadow-sm"
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
              <span className="text-xs text-gray-400 self-center">Try:</span>
              {EXAMPLE_SEARCHES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setDescription(ex)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-full transition-colors"
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
            <div className="inline-block w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-500">{loadingStep}</p>
            {loadingStep.includes("Facebook") && (
              <p className="text-xs text-gray-400 mt-2">Facebook takes ~10s (launching browser)</p>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {sourceErrors.length > 0 && (
          <div className="mb-4 space-y-1">
            {sourceErrors.map((e) => (
              <div key={e} className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                ⚠️ {e}
              </div>
            ))}
          </div>
        )}

{!loading && searchParams && (
          <>
            {/* Source tabs */}
            {listings.length > 0 && (
              <div className="flex gap-1 mb-5 border-b border-gray-200">
                {sourceTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveSource(tab.key)}
                    className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                      activeSource === tab.key
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab.label}
                    <span className="ml-1.5 text-xs text-gray-400">({counts[tab.key]})</span>
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
                    className="group flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all overflow-hidden"
                  >
                    <div className="h-44 bg-gray-100 flex items-center justify-center overflow-hidden">
                      {listing.imageUrl ? (
                        <img
                          src={listing.imageUrl}
                          alt={listing.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <span className="text-4xl text-gray-300">📦</span>
                      )}
                    </div>
                    <div className="p-4 flex flex-col gap-2 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug flex-1">
                          {listing.title}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                          listing.source === "ebay"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-blue-100 text-blue-800"
                        }`}>
                          {listing.source === "ebay" ? "eBay" : "Facebook"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-2">
                        <span className="text-lg font-bold text-gray-900">
                          {listing.price != null ? `$${listing.price.toLocaleString()}` : "Price N/A"}
                        </span>
                        <span className="text-xs text-gray-400">{listing.location}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400">
                <p>No results found. Try broadening your search or a different location.</p>
              </div>
            )}

            {/* Craigslist link-out (can't scrape) */}
            {clUrl && (
              <div className="mt-8">
                <a
                  href={clUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-white border border-gray-200 rounded-2xl px-6 py-4 hover:border-indigo-300 hover:shadow-md transition-all"
                >
                  <span className="text-2xl">🏷️</span>
                  <div>
                    <p className="font-semibold text-gray-900">Craigslist</p>
                    <p className="text-sm text-gray-400">Open pre-filled search (blocks automated access) ↗</p>
                  </div>
                </a>
              </div>
            )}
          </>
        )}

        {!loading && !searchParams && (
          <div className="text-center py-20">
            <div className="text-7xl mb-4">🛒</div>
            <p className="text-xl font-medium text-gray-400">Describe what you&apos;re looking for above</p>
            <p className="text-sm mt-2 text-gray-300">Searches eBay & Facebook Marketplace inline</p>
          </div>
        )}
      </div>
    </main>
  );
}
