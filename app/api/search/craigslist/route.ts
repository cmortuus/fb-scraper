import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import type { Listing } from "@/app/lib/types";
import { CITY_TO_CL } from "@/app/lib/cities";

function cityToSubdomain(location: string): string {
  const lower = location.toLowerCase().trim();
  return CITY_TO_CL[lower] ?? lower.replace(/\s+/g, "");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const keywords = searchParams.get("keywords") ?? "";
  const category = searchParams.get("category") ?? "sss";
  const location = searchParams.get("location") ?? "sfbay";
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");

  const subdomain = cityToSubdomain(location);

  const params = new URLSearchParams({
    format: "rss",
    query: keywords,
    ...(minPrice ? { min_price: minPrice } : {}),
    ...(maxPrice ? { max_price: maxPrice } : {}),
  });

  const url = `https://${subdomain}.craigslist.org/search/${category}?${params.toString()}`;

  let xml: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } catch (err) {
    console.error("Craigslist fetch error:", err);
    return NextResponse.json({ listings: [], error: "Could not reach Craigslist" });
  }

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  let parsed: {
    rss?: { channel?: { item?: CraigslistItem | CraigslistItem[] } };
  };
  try {
    parsed = parser.parse(xml);
  } catch {
    return NextResponse.json({ listings: [], error: "Failed to parse Craigslist feed" });
  }

  const items = parsed?.rss?.channel?.item;
  if (!items) return NextResponse.json({ listings: [] });

  const itemArr = Array.isArray(items) ? items : [items];

  const listings: Listing[] = itemArr.slice(0, 30).map((item, i) => {
    const priceMatch = (item.title ?? "").match(/\$[\d,]+/);
    const priceStr = priceMatch ? priceMatch[0].replace(/[$,]/g, "") : null;

    // Craigslist RSS encodes image in enclosure or description
    const imgMatch = (item["content:encoded"] ?? item.description ?? "").match(
      /<img[^>]+src="([^"]+)"/
    );

    return {
      id: `cl-${i}-${Date.now()}`,
      title: item.title ?? "No title",
      price: priceStr ? parseFloat(priceStr) : null,
      imageUrl: imgMatch ? imgMatch[1] : null,
      location: item["g-core:neighborhood"] ?? item["georss:point"] ?? location,
      postedAt: item.pubDate ?? null,
      sourceUrl: item.link ?? "",
      source: "craigslist",
      description: item.description?.replace(/<[^>]+>/g, "").slice(0, 200) ?? "",
    };
  });

  return NextResponse.json({ listings });
}

interface CraigslistItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  "content:encoded"?: string;
  "g-core:neighborhood"?: string;
  "georss:point"?: string;
}
