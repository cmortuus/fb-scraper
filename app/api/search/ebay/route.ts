import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import type { Listing } from "@/app/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const keywords = searchParams.get("keywords") ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");

  // Scrapes public eBay search — no API key needed
  const params = new URLSearchParams({
    _nkw: keywords,
    _sop: "15",               // sort: best match
    LH_ItemCondition: "3000", // used
  });
  if (categoryId) params.set("_sacat", categoryId);
  if (minPrice) params.set("_udlo", minPrice);
  if (maxPrice) params.set("_udhi", maxPrice);

  const url = `https://www.ebay.com/sch/i.html?${params.toString()}`;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    console.error("eBay fetch error:", err);
    return NextResponse.json({ listings: [], error: "Could not reach eBay" });
  }

  const $ = cheerio.load(html);
  const listings: Listing[] = [];

  $("li.s-item").each((i, el) => {
    if (i >= 60) return false;

    const title = $(el).find(".s-item__title").text().trim();
    if (!title || title === "Shop on eBay") return;

    const priceText = $(el).find(".s-item__price").first().text().trim();
    const priceMatch = priceText.match(/[\d,]+\.?\d*/);
    const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, "")) : null;

    const link = $(el).find("a.s-item__link").attr("href") ?? "";
    const image = $(el).find("img.s-item__image-img").attr("src") ?? null;
    const location = $(el).find(".s-item__location").text().replace(/^From\s*/i, "").trim() || "eBay";

    listings.push({
      id: `ebay-${i}-${Date.now()}`,
      title,
      price,
      imageUrl: image,
      location,
      postedAt: null,
      sourceUrl: link.split("?")[0],
      source: "ebay",
    });
  });

  return NextResponse.json({ listings });
}
