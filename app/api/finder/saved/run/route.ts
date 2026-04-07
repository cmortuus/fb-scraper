import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import type { SavedFinderSearch } from "@/app/lib/saved-finder-searches";
import { buildListingEmailHtml } from "@/app/lib/saved-finder-searches";
import type { Listing, SearchParams } from "@/app/lib/types";

const DATA_FILE = path.join(process.cwd(), "data", "saved-finder-searches.json");

function load(): SavedFinderSearch[] {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function save(searches: SavedFinderSearch[]) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(searches, null, 2));
}

export async function POST(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  const searches = load();
  const idx = searches.findIndex((s) => s.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const search = searches[idx];

  const baseUrl = new URL(req.url);
  const host = `${baseUrl.protocol}//${baseUrl.host}`;

  try {
    // Step 1: Parse the search description with Claude
    const parseRes = await fetch(`${host}/api/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: search.description }),
    });
    if (!parseRes.ok) {
      return NextResponse.json({ error: "Failed to parse search" }, { status: 502 });
    }
    const { params } = (await parseRes.json()) as { params: SearchParams };

    // Apply saved location/radius overrides
    if (search.location) params.location = search.location;
    if (search.radiusMiles) params.radiusMiles = search.radiusMiles;

    // Step 2: Search eBay + Facebook in parallel
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
      fetch(`${host}/api/search/ebay?${ebayParams}`).then((r) => r.json()),
      fetch(`${host}/api/search/facebook?${fbParams}`).then((r) => r.json()),
    ]);

    const allListings: Listing[] = [];
    if (ebayResult.status === "fulfilled") allListings.push(...(ebayResult.value.listings ?? []));
    if (fbResult.status === "fulfilled") allListings.push(...(fbResult.value.listings ?? []));

    // Step 3: Filter for relevance
    let relevantListings = allListings;
    if (allListings.length > 0) {
      try {
        const filterRes = await fetch(`${host}/api/filter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listings: allListings, description: search.description }),
        });
        if (filterRes.ok) {
          const data = await filterRes.json();
          relevantListings = data.listings;
        }
      } catch {}
    }

    // Sort by price
    relevantListings.sort((a, b) => {
      if (a.price == null && b.price == null) return 0;
      if (a.price == null) return 1;
      if (b.price == null) return -1;
      return a.price - b.price;
    });

    // Update lastRun
    searches[idx].lastRun = new Date().toISOString();
    searches[idx].lastResultCount = relevantListings.length;
    save(searches);

    if (relevantListings.length === 0) {
      return NextResponse.json({ sent: false, resultsFound: 0, message: "No matching listings found" });
    }

    // Step 4: Send email
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    if (!gmailUser || !gmailPass) {
      return NextResponse.json({
        error: "Email not configured — add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local",
        resultsFound: relevantListings.length,
      }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });

    const cheapest = relevantListings[0];
    const priceRange = cheapest.price != null ? `from $${cheapest.price}` : "";

    await transporter.sendMail({
      from: `"Used Finder" <${gmailUser}>`,
      to: search.email,
      subject: `🔍 ${relevantListings.length} listing${relevantListings.length > 1 ? "s" : ""} found ${priceRange} · ${search.name}`,
      html: buildListingEmailHtml(
        relevantListings.slice(0, 20),
        `Used Finder: ${search.name}`,
        `${relevantListings.length} listing${relevantListings.length > 1 ? "s" : ""} matching "${search.description}"`
      ),
    });

    return NextResponse.json({ sent: true, resultsFound: relevantListings.length });
  } catch (err) {
    console.error("Finder saved search run error:", err);
    return NextResponse.json(
      { error: `Failed: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }
}
