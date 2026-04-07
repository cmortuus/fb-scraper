import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import path from "path";
import os from "os";
import type { Listing } from "@/app/lib/types";
import { NATIONWIDE_FB_CITIES } from "@/app/lib/cities";
import { withPlaywrightLock } from "@/app/lib/playwright-lock";

const BRAVE_USER_DATA = path.join(
  os.homedir(),
  "Library/Application Support/BraveSoftware/Brave-Browser"
);
const BRAVE_EXECUTABLE =
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const keywords = searchParams.get("keywords") ?? "";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";

  if (!keywords.trim()) {
    return NextResponse.json({ listings: [], error: "keywords required" }, { status: 400 });
  }

  return withPlaywrightLock(async () => {
    let browser;
    try {
      browser = await chromium.launchPersistentContext(BRAVE_USER_DATA, {
        headless: true,
        executablePath: BRAVE_EXECUTABLE,
        args: [
          "--no-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--disable-dev-shm-usage",
        ],
        ignoreDefaultArgs: ["--enable-automation"],
      });
    } catch {
      browser = await chromium.launchPersistentContext(
        path.join(os.tmpdir(), "fb-marketplace-session"),
        { headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] }
      );
    }

    const allListings: Listing[] = [];
    const errors: string[] = [];

    try {
      const page = browser.pages()[0] ?? (await browser.newPage());
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      });

      for (const [cityName, citySlug] of NATIONWIDE_FB_CITIES) {
        try {
          const params = new URLSearchParams({ query: keywords });
          if (minPrice) params.set("minPrice", minPrice);
          if (maxPrice) params.set("maxPrice", maxPrice);
          // Use a wide radius to cover the metro area
          params.set("exact_radius", "100");
          params.set("radius_unit", "imperial");

          const url = `https://www.facebook.com/marketplace/${citySlug}/search?${params}`;
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

          // Dismiss login dialog
          try {
            await page.locator('[aria-label="Close"]').first().click({ timeout: 2000 });
          } catch {}

          // Wait for listings
          try {
            await page.waitForSelector('a[href*="/marketplace/item/"]', { timeout: 8000 });
          } catch {
            console.log(`[Nationwide] No listings found for ${cityName}, skipping`);
            continue;
          }

          // Quick scroll to load a few listings
          for (let s = 0; s < 3; s++) {
            await page.evaluate(() => window.scrollBy(0, 1500));
            await page.waitForTimeout(800);
          }

          // Extract listings
          const cityListings: Listing[] = await page.evaluate((city: string) => {
            const results: Listing[] = [];
            const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/marketplace/item/"]'));
            const seen = new Set<string>();

            for (const a of links) {
              if (results.length >= 10) break;
              const href = a.href.split("?")[0];
              if (seen.has(href)) continue;
              seen.add(href);

              const img = a.querySelector<HTMLImageElement>("img");
              const spans = Array.from(a.querySelectorAll("span"));

              const priceSpan = spans.find((s) => s.textContent?.trim().startsWith("$"));
              const priceText = priceSpan?.textContent?.trim() ?? "";
              const priceMatch = priceText.match(/[\d,]+/);
              const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, "")) : null;

              const titleSpan = spans
                .filter((s) => !s.textContent?.startsWith("$") && (s.textContent?.length ?? 0) > 5)
                .sort((a, b) => (b.textContent?.length ?? 0) - (a.textContent?.length ?? 0))[0];
              const title = titleSpan?.textContent?.trim() ?? "Facebook Marketplace listing";

              const locationSpan = spans.find(
                (s) =>
                  s !== priceSpan &&
                  s !== titleSpan &&
                  (s.textContent?.length ?? 0) > 2 &&
                  (s.textContent?.length ?? 0) < 50
              );

              results.push({
                id: `fb-${city}-${results.length}`,
                title,
                price,
                imageUrl: img?.src ?? null,
                location: locationSpan?.textContent?.trim() ?? city,
                postedAt: null,
                sourceUrl: href,
                source: "facebook" as const,
              });
            }
            return results;
          }, cityName);

          allListings.push(...cityListings);
          console.log(`[Nationwide] ${cityName}: ${cityListings.length} listings`);

          // Brief pause between cities to avoid rate limiting
          await page.waitForTimeout(1500);
        } catch (err) {
          console.error(`[Nationwide] Error searching ${cityName}:`, err);
          errors.push(`${cityName}: ${err instanceof Error ? err.message : "failed"}`);
        }
      }

      // Deduplicate by source URL
      const seen = new Set<string>();
      const deduplicated = allListings.filter((l) => {
        const key = l.sourceUrl.split("?")[0];
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Sort by price
      deduplicated.sort((a, b) => {
        if (a.price == null && b.price == null) return 0;
        if (a.price == null) return 1;
        if (b.price == null) return -1;
        return a.price - b.price;
      });

      console.log(`[Nationwide] Total: ${deduplicated.length} unique listings from ${NATIONWIDE_FB_CITIES.length} cities`);
      return NextResponse.json({
        listings: deduplicated,
        rawCount: allListings.length,
        citiesSearched: NATIONWIDE_FB_CITIES.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      console.error("Nationwide scrape error:", err);
      return NextResponse.json({
        listings: allListings,
        error: `Nationwide search failed: ${err instanceof Error ? err.message : "unknown"}`,
      });
    } finally {
      await browser.close();
    }
  });
}
