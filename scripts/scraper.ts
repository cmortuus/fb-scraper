import { chromium } from "playwright";
import pg from "pg";
import path from "path";
import os from "os";

// --- Config ---
// 95% focus: Baltimore + nearby cities within ~60 miles
const LOCAL_CITIES = ["baltimore", "washington", "annapolis", "frederick", "columbia"];
// 5%: wider net within ~500 miles (scraped once every few cycles)
const REGIONAL_CITIES = ["philadelphia", "richmond", "pittsburgh", "norfolk", "harrisburg"];
const CATEGORIES = ["", "vehicles", "sports", "electronics", "home", "free"]; // "" = all
const CYCLE_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes
const JITTER_MS = 10_000; // 10-20s random delay between scrapes
let cycleCount = 0;

// Full search terms for local cities — cast a wide net
const LOCAL_SEARCH_TERMS = [
  // Racks & cages
  "squat rack", "power rack", "half rack", "full rack", "cage rack",
  "squat stand", "monster rack", "rogue rack", "titan rack",
  // Hack squat & leg machines
  "hack squat", "cybex hack squat", "leg press", "leg curl", "leg extension",
  "seated leg press", "vertical leg press", "pendulum squat",
  // Benches
  "bench press", "weight bench", "adjustable bench", "flat bench",
  "incline bench", "decline bench", "olympic bench", "utility bench",
  "FID bench",
  // Free weights — dumbbells
  "dumbbells", "adjustable dumbbells", "dumbbell set", "dumbbell rack",
  "power blocks", "powerblock", "bowflex dumbbells", "ironmaster dumbbells",
  "hex dumbbells", "rubber dumbbells",
  // Free weights — barbells & plates
  "barbell", "olympic barbell", "trap bar", "hex bar", "EZ curl bar",
  "safety squat bar", "cambered bar", "swiss bar", "football bar",
  "buffalo bar", "axle bar", "log bar", "multi grip bar",
  "specialty barbell", "deadlift bar", "squat bar", "bench bar",
  "curl bar", "tricep bar", "open trap bar",
  "weight plates", "olympic weights", "bumper plates", "iron plates",
  "rubber plates", "fractional plates", "change plates",
  "45 lb plates", "25 lb plates",
  // Kettlebells
  "kettlebell", "kettlebell set", "competition kettlebell",
  // Cable & pulley machines
  "cable machine", "cable crossover", "functional trainer",
  "lat pulldown", "low row", "cable stack", "pulley system",
  "weight stack",
  // Smith & multi-station
  "smith machine", "all in one gym", "multi gym", "home gym",
  "gym equipment", "exercise equipment", "fitness equipment",
  // Press machines
  "chest press", "incline press", "shoulder press machine",
  "overhead press", "seated press", "machine press",
  // Row machines (strength)
  "chest supported row", "seated row", "t-bar row", "row machine",
  "plate loaded row",
  // Cardio
  "treadmill", "rowing machine", "exercise bike", "spin bike",
  "elliptical", "stair climber", "assault bike", "echo bike",
  "air bike", "peloton", "nordictrack", "concept 2",
  // Bodyweight & accessories
  "pull up bar", "dip station", "dip bar", "pull up station",
  "resistance bands", "battle ropes", "ab roller", "gymnastic rings",
  "plyo box", "jump box",
  // Accessories & attachments
  "cable attachment", "lat bar", "tricep rope", "v-bar handle",
  "mag grip", "dip belt", "lifting belt", "weight vest",
  "knee sleeves", "wrist wraps", "lifting straps",
  "barbell collar", "barbell clamp", "spring clip",
  "medicine ball", "slam ball", "wall ball", "sandbag",
  "foam roller", "ab wheel", "landmine handle",
  // More machines
  "preacher curl", "sissy squat", "calf raise machine",
  "hip thrust machine", "glute drive", "pec deck", "pec fly",
  "chest fly machine", "rear delt machine", "abductor machine",
  "adductor machine", "ab machine", "ab crunch machine",
  "hyperextension bench", "roman chair",
  // Flooring & storage
  "gym flooring", "rubber mats", "stall mats", "plate tree",
  "dumbbell tree", "weight storage", "barbell holder", "plate storage",
  // Brands
  "rogue fitness", "rogue", "hammer strength", "life fitness",
  "atlantis gym", "atlantis strength", "prime fitness",
  "strive equipment", "cybex", "precor", "nautilus",
  "body solid", "titan fitness", "rep fitness", "force usa",
  "inspire fitness", "hoist fitness", "matrix fitness",
  "star trac", "technogym",
  // Specialty
  "GHD", "glute ham", "reverse hyper", "belt squat",
  "landmine attachment", "jammer arms", "monolift",
  "deadlift platform", "lifting platform",
  "olympic lifting", "weightlifting",
  "garage gym", "gym closing", "gym liquidation",
];

// Simpler search terms for regional cities — just the big categories
const REGIONAL_SEARCH_TERMS = [
  "home gym",
  "squat rack",
  "power rack",
  "hack squat",
  "dumbbells",
  "weight plates",
  "gym equipment",
  "rogue fitness",
  "hammer strength",
  "cable machine",
  "functional trainer",
  "gym liquidation",
];

const BRAVE_USER_DATA = path.join(
  os.homedir(),
  "Library/Application Support/BraveSoftware/Brave-Browser"
);
const BRAVE_EXECUTABLE =
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";

// Connects via SSH tunnel: ssh -L 5433:localhost:5432 root@lethal.dev
// (the db container maps to localhost inside the VPS)
const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

interface RawListing {
  fb_id: string;
  title: string;
  price: number | null;
  image_url: string | null;
  location: string;
  source_url: string;
}

async function scrapeFB(
  city: string,
  category: string,
  searchQuery?: string
): Promise<RawListing[]> {
  let url: string;
  if (searchQuery) {
    const q = encodeURIComponent(searchQuery);
    url = `https://www.facebook.com/marketplace/${city}/search?query=${q}`;
  } else {
    const segments = ["marketplace", city];
    if (category) segments.push(category);
    url = `https://www.facebook.com/${segments.join("/")}`;
  }

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

  try {
    const page = browser.pages()[0] ?? (await browser.newPage());

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

    // Dismiss login dialog
    try {
      await page
        .locator('[aria-label="Close"]')
        .first()
        .click({ timeout: 3000 });
    } catch {}

    // Wait for listings
    try {
      await page.waitForSelector('a[href*="/marketplace/item/"]', {
        timeout: 12000,
      });
    } catch {}

    // Scroll to load more listings
    for (let s = 0; s < 15; s++) {
      await page.evaluate(() => window.scrollBy(0, 1500));
      await page.waitForTimeout(800);
    }

    const listings: RawListing[] = await page.evaluate(() => {
      const results: RawListing[] = [];
      const seen = new Set<string>();
      const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          'a[href*="/marketplace/item/"]'
        )
      );

      for (const a of links) {
        if (results.length >= 120) break;
        const href = a.href.split("?")[0];
        if (seen.has(href)) continue;
        seen.add(href);

        // Extract fb_id from URL like /marketplace/item/123456/
        const idMatch = href.match(/\/marketplace\/item\/(\d+)/);
        if (!idMatch) continue;

        const img = a.querySelector<HTMLImageElement>("img");
        const spans = Array.from(a.querySelectorAll("span"));

        const priceSpan = spans.find((s) =>
          s.textContent?.trim().startsWith("$")
        );
        const priceText = priceSpan?.textContent?.trim() ?? "";
        const priceMatch = priceText.match(/[\d,]+/);
        const price = priceMatch
          ? parseFloat(priceMatch[0].replace(/,/g, ""))
          : null;

        const titleSpan = spans
          .filter(
            (s) =>
              !s.textContent?.startsWith("$") &&
              (s.textContent?.length ?? 0) > 5
          )
          .sort(
            (a, b) =>
              (b.textContent?.length ?? 0) - (a.textContent?.length ?? 0)
          )[0];
        const title =
          titleSpan?.textContent?.trim() ?? "Facebook Marketplace listing";

        const locationSpan = spans.find(
          (s) =>
            s !== priceSpan &&
            s !== titleSpan &&
            (s.textContent?.length ?? 0) > 2 &&
            (s.textContent?.length ?? 0) < 50 &&
            !s.textContent?.trim().startsWith("$") &&
            !s.textContent?.trim().match(/^\d[\d,]*$/) &&
            !s.textContent?.trim().match(/^(Free|Pending)$/i)
        );

        results.push({
          fb_id: idMatch[1],
          title,
          price,
          image_url: img?.src ?? null,
          location:
            locationSpan?.textContent?.trim() ?? "Facebook Marketplace",
          source_url: href,
        });
      }

      return results;
    });

    return listings;
  } finally {
    await browser.close();
  }
}

async function upsertListings(
  listings: RawListing[],
  city: string,
  category: string
) {
  if (listings.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const l of listings) {
      await client.query(
        `INSERT INTO fb_listings (fb_id, title, price, image_url, location, source_url, city, category, scraped_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (fb_id) DO UPDATE SET
           title = EXCLUDED.title,
           price = EXCLUDED.price,
           image_url = EXCLUDED.image_url,
           location = EXCLUDED.location,
           scraped_at = NOW()`,
        [
          l.fb_id,
          l.title,
          l.price,
          l.image_url,
          l.location,
          l.source_url,
          city,
          category,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

async function cleanOldListings() {
  try {
    const result = await pool.query(
      "DELETE FROM fb_listings WHERE scraped_at < NOW() - INTERVAL '72 hours'"
    );
    if ((result.rowCount ?? 0) > 0) {
      console.log(`  Cleaned ${result.rowCount} old listings`);
    }
  } catch (err) {
    console.error("  ✗ Cleanup failed:", err instanceof Error ? err.message : err);
  }
}

async function checkDbConnection(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomJitter() {
  return JITTER_MS + Math.random() * JITTER_MS; // 30-60s
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function runCycleForCity(city: string, searchTerms: string[]) {
  const categories = shuffle(CATEGORIES);
  console.log(
    `\n[${new Date().toLocaleTimeString()}] Scraping ${city} (${categories.length} categories + ${searchTerms.length} searches)`
  );

  // Phase 1: Scrape by category
  for (const cat of categories) {
    const label = cat || "all";
    console.log(`  ${city}/${label}...`);

    try {
      const listings = await scrapeFB(city, cat);
      console.log(`    → ${listings.length} listings`);
      await upsertListings(listings, city, cat);
    } catch (err) {
      console.error(
        `    ✗ ${label}:`,
        err instanceof Error ? err.message : err
      );
    }

    const delay = randomJitter();
    await sleep(delay);
  }

  // Phase 2: Targeted keyword searches
  const terms = shuffle(searchTerms);
  for (const term of terms) {
    console.log(`  ${city} search: "${term}"...`);

    try {
      const listings = await scrapeFB(city, "", term);
      console.log(`    → ${listings.length} listings`);
      await upsertListings(listings, city, "search:" + term.replace(/\s+/g, "-"));
    } catch (err) {
      console.error(
        `    ✗ "${term}":`,
        err instanceof Error ? err.message : err
      );
    }

    // Shorter jitter for searches (8-15s)
    const delay = 8_000 + Math.random() * 7_000;
    await sleep(delay);
  }
}

async function runCycle() {
  cycleCount++;

  // Always scrape local cities (within ~60mi of Baltimore)
  const cities = shuffle(LOCAL_CITIES);

  // Every 20th cycle (~7 hours), also scrape regional cities (within ~500mi)
  const includeRegional = cycleCount % 20 === 0;
  if (includeRegional) {
    cities.push(...shuffle(REGIONAL_CITIES));
  }

  console.log(
    `\n${"=".repeat(60)}\n[${new Date().toLocaleTimeString()}] Cycle #${cycleCount} — ${cities.length} cities${includeRegional ? " (+ regional)" : ""}\n${"=".repeat(60)}`
  );

  for (const city of cities) {
    const isLocal = LOCAL_CITIES.includes(city);
    await runCycleForCity(city, isLocal ? LOCAL_SEARCH_TERMS : REGIONAL_SEARCH_TERMS);
  }

  await cleanOldListings();

  // Log DB stats
  try {
    const stats = await pool.query("SELECT city, COUNT(*) as cnt FROM fb_listings GROUP BY city ORDER BY cnt DESC");
    const total = stats.rows.reduce((sum: number, r: { cnt: string }) => sum + parseInt(r.cnt), 0);
    console.log(`\n  DB total: ${total} listings`);
    for (const r of stats.rows) {
      console.log(`    ${r.city}: ${r.cnt}`);
    }
  } catch {}

  console.log(`[${new Date().toLocaleTimeString()}] Cycle complete`);
}

async function main() {
  console.log("FB Marketplace Scraper starting");
  console.log(`Local cities: ${LOCAL_CITIES.join(", ")}`);
  console.log(`Regional cities: ${REGIONAL_CITIES.join(", ")} (every 20th cycle)`);
  console.log(`Categories: ${CATEGORIES.map((c) => c || "all").join(", ")}`);
  console.log(`Local search terms: ${LOCAL_SEARCH_TERMS.length} | Regional: ${REGIONAL_SEARCH_TERMS.length}`);
  console.log(`Max listings/page: 120 | Scrolls: 15 | Retention: 72h`);
  console.log(`Interval: ${CYCLE_INTERVAL_MS / 60000} minutes`);
  console.log(`DB: ${DATABASE_URL.replace(/:[^:@]+@/, ":***@")}`);

  // Test DB connection
  try {
    await pool.query("SELECT 1");
    console.log("DB connection OK\n");
  } catch (err) {
    console.error("DB connection failed:", err);
    process.exit(1);
  }

  // Run immediately, then loop
  while (true) {
    const start = Date.now();
    try {
      // Check DB before starting a cycle
      if (!(await checkDbConnection())) {
        console.error("\n  ✗ DB connection lost — waiting 60s before retry...");
        await sleep(60_000);
        continue;
      }
      await runCycle();
    } catch (err) {
      console.error(
        `\n  ✗ Cycle error: ${err instanceof Error ? err.message : err}`
      );
      console.log("  Waiting 60s before retrying...");
      await sleep(60_000);
      continue;
    }
    const elapsed = Date.now() - start;
    const wait = Math.max(0, CYCLE_INTERVAL_MS - elapsed);
    if (wait > 0) {
      console.log(
        `Sleeping ${Math.round(wait / 60000)} min until next cycle...`
      );
      await sleep(wait);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
