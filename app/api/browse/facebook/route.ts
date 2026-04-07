import { NextRequest, NextResponse } from "next/server";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not set — browse API will fail");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") ?? "baltimore";
  const category = searchParams.get("category") ?? "";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const queryText = searchParams.get("query")?.trim() ?? "";

  try {
    let query = `SELECT fb_id, title, price, image_url, location, source_url, city, category, scraped_at
                 FROM fb_listings WHERE city = $1`;
    const params: (string | number)[] = [city];
    let idx = 2;

    if (category) {
      query += ` AND category = $${idx}`;
      params.push(category);
      idx++;
    }
    if (minPrice) {
      query += ` AND price >= $${idx}`;
      params.push(Number(minPrice));
      idx++;
    }
    if (maxPrice) {
      query += ` AND price <= $${idx}`;
      params.push(Number(maxPrice));
      idx++;
    }
    if (queryText) {
      query += ` AND (
        title ILIKE $${idx}
        OR location ILIKE $${idx}
      )`;
      params.push(`%${queryText}%`);
      idx++;
    }

    query += ` ORDER BY scraped_at DESC LIMIT 60`;

    const result = await pool.query(query, params);

    const listings = result.rows.map((row) => ({
      id: `fb-${row.fb_id}`,
      title: row.title,
      price: row.price ? Number(row.price) : null,
      imageUrl: row.image_url,
      location: row.location,
      postedAt: null,
      sourceUrl: row.source_url,
      source: "facebook" as const,
    }));

    return NextResponse.json({ listings, cached: false });
  } catch (err) {
    console.error("Browse DB error:", err);
    return NextResponse.json(
      {
        listings: [],
        error: `Database error: ${err instanceof Error ? err.message : "unknown"}`,
      },
      { status: 500 }
    );
  }
}
