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

    if (category === "gym") {
      // Special virtual category: match targeted search results + gym-related titles
      query += ` AND (category LIKE 'search:%' OR (
        title ILIKE '%gym%' OR title ILIKE '%dumbbell%'
        OR title ILIKE '%barbell%' OR title ILIKE '%bench press%' OR title ILIKE '%squat%'
        OR title ILIKE '%hack squat%' OR title ILIKE '%power rack%' OR title ILIKE '%squat rack%'
        OR title ILIKE '%half rack%' OR title ILIKE '%squat stand%'
        OR title ILIKE '%kettlebell%' OR title ILIKE '%kettle bell%'
        OR title ILIKE '%treadmill%' OR title ILIKE '%elliptical%' OR title ILIKE '%stair climber%'
        OR title ILIKE '%exercise bike%' OR title ILIKE '%spin bike%' OR title ILIKE '%peloton%'
        OR title ILIKE '%assault bike%' OR title ILIKE '%echo bike%' OR title ILIKE '%air bike%'
        OR title ILIKE '%bowflex%' OR title ILIKE '%rowing machine%' OR title ILIKE '%rower%'
        OR title ILIKE '%concept 2%' OR title ILIKE '%nordictrack%'
        OR title ILIKE '%weight plate%' OR title ILIKE '%bumper plate%' OR title ILIKE '%olympic plate%'
        OR title ILIKE '%iron plate%' OR title ILIKE '%rubber plate%'
        OR title ILIKE '%weight bench%' OR title ILIKE '%adjustable bench%' OR title ILIKE '%flat bench%'
        OR title ILIKE '%incline bench%' OR title ILIKE '%decline bench%' OR title ILIKE '%utility bench%'
        OR title ILIKE '%pull up bar%' OR title ILIKE '%pullup%' OR title ILIKE '%chin up%'
        OR title ILIKE '%dip station%' OR title ILIKE '%dip bar%'
        OR title ILIKE '%resistance band%' OR title ILIKE '%cable machine%' OR title ILIKE '%cable crossover%'
        OR title ILIKE '%smith machine%' OR title ILIKE '%leg press%' OR title ILIKE '%lat pulldown%'
        OR title ILIKE '%leg curl%' OR title ILIKE '%leg extension%' OR title ILIKE '%pendulum squat%'
        OR title ILIKE '%home gym%' OR title ILIKE '%weight set%' OR title ILIKE '%weight lifting%'
        OR title ILIKE '%olympic weight%' OR title ILIKE '%bumper%lbs%'
        OR title ILIKE '%deadlift%' OR title ILIKE '%trap bar%' OR title ILIKE '%hex bar%'
        OR title ILIKE '%EZ curl%' OR title ILIKE '%safety squat bar%'
        OR title ILIKE '%adjustable dumbbell%' OR title ILIKE '%exercise equipment%'
        OR title ILIKE '%fitness equipment%' OR title ILIKE '%workout%'
        OR title ILIKE '%atlantis%' OR title ILIKE '%prime fitness%'
        OR title ILIKE '%strive%' OR title ILIKE '%rogue%' OR title ILIKE '%hammer strength%'
        OR title ILIKE '%power block%' OR title ILIKE '%powerblock%'
        OR title ILIKE '%functional trainer%' OR title ILIKE '%weight stack%'
        OR title ILIKE '%chest press%' OR title ILIKE '%incline press%' OR title ILIKE '%shoulder press%'
        OR title ILIKE '%cybex%' OR title ILIKE '%chest supported row%' OR title ILIKE '%seated row%'
        OR title ILIKE '%life fitness%' OR title ILIKE '%precor%' OR title ILIKE '%nautilus%'
        OR title ILIKE '%body solid%' OR title ILIKE '%titan fitness%' OR title ILIKE '%rep fitness%'
        OR title ILIKE '%technogym%' OR title ILIKE '%hoist%'
        OR title ILIKE '%GHD%' OR title ILIKE '%glute ham%' OR title ILIKE '%reverse hyper%'
        OR title ILIKE '%belt squat%' OR title ILIKE '%landmine%' OR title ILIKE '%jammer arms%'
        OR title ILIKE '%garage gym%' OR title ILIKE '%gym closing%' OR title ILIKE '%gym liquidation%'
        OR title ILIKE '%plyo box%' OR title ILIKE '%battle rope%'
        OR title ILIKE '%gym flooring%' OR title ILIKE '%stall mat%' OR title ILIKE '%rubber mat%'
        OR title ILIKE '%swiss bar%' OR title ILIKE '%buffalo bar%' OR title ILIKE '%football bar%'
        OR title ILIKE '%axle bar%' OR title ILIKE '%log bar%' OR title ILIKE '%multi grip bar%'
        OR title ILIKE '%deadlift bar%' OR title ILIKE '%squat bar%' OR title ILIKE '%curl bar%'
        OR title ILIKE '%tricep bar%' OR title ILIKE '%open trap bar%' OR title ILIKE '%specialty bar%'
        OR title ILIKE '%olympic bar%' OR title ILIKE '%cambered bar%'
        OR title ILIKE '%cable attachment%' OR title ILIKE '%lat bar%' OR title ILIKE '%tricep rope%'
        OR title ILIKE '%v-bar%' OR title ILIKE '%mag grip%' OR title ILIKE '%dip belt%'
        OR title ILIKE '%lifting belt%' OR title ILIKE '%weight vest%'
        OR title ILIKE '%medicine ball%' OR title ILIKE '%slam ball%' OR title ILIKE '%wall ball%'
        OR title ILIKE '%barbell collar%' OR title ILIKE '%barbell clamp%'
        OR title ILIKE '%preacher curl%' OR title ILIKE '%sissy squat%'
        OR title ILIKE '%calf raise%' OR title ILIKE '%hip thrust%' OR title ILIKE '%glute drive%'
        OR title ILIKE '%pec deck%' OR title ILIKE '%pec fly%' OR title ILIKE '%chest fly%'
        OR title ILIKE '%rear delt%' OR title ILIKE '%ab machine%' OR title ILIKE '%ab crunch%'
        OR title ILIKE '%hyperextension%' OR title ILIKE '%roman chair%'
        OR title ILIKE '%abductor%' OR title ILIKE '%adductor%'
        OR title ILIKE '%force usa%' OR title ILIKE '%inspire fitness%' OR title ILIKE '%matrix fitness%'
        OR title ILIKE '%star trac%' OR title ILIKE '%iron master%' OR title ILIKE '%ironmaster%'
      ))`;
    } else if (category) {
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

    if (category === "gym") {
      // Relevance ranking: score listings by how strongly they match gym equipment
      // High-confidence terms (very specific to gym equipment) score 3
      // Medium-confidence terms (likely gym but could be other things) score 2
      // Low-confidence / broad terms score 1
      query += ` ORDER BY (
        -- Barbells & bars (high confidence)
        CASE WHEN title ILIKE '%barbell%' OR title ILIKE '%olympic bar%' OR title ILIKE '%EZ curl%'
          OR title ILIKE '%curl bar%' OR title ILIKE '%trap bar%' OR title ILIKE '%hex bar%'
          OR title ILIKE '%safety squat bar%' OR title ILIKE '%swiss bar%' OR title ILIKE '%buffalo bar%'
          OR title ILIKE '%football bar%' OR title ILIKE '%axle bar%' OR title ILIKE '%log bar%'
          OR title ILIKE '%deadlift bar%' OR title ILIKE '%squat bar%' OR title ILIKE '%cambered bar%'
          OR title ILIKE '%multi grip bar%' OR title ILIKE '%tricep bar%' OR title ILIKE '%open trap bar%'
          OR title ILIKE '%specialty bar%' THEN 3 ELSE 0 END
        -- Racks & cages (high confidence when paired with gym terms)
        + CASE WHEN title ILIKE '%squat rack%' OR title ILIKE '%power rack%' OR title ILIKE '%half rack%'
          OR title ILIKE '%squat stand%' OR title ILIKE '%cage rack%' OR title ILIKE '%squat cage%'
          OR title ILIKE '%power cage%' THEN 3 ELSE 0 END
        -- Dumbbells & kettlebells (high confidence)
        + CASE WHEN title ILIKE '%dumbbell%' OR title ILIKE '%kettlebell%' OR title ILIKE '%kettle bell%'
          OR title ILIKE '%powerblock%' OR title ILIKE '%power block%' OR title ILIKE '%ironmaster%'
          OR title ILIKE '%adjustable dumbbell%' OR title ILIKE '%hex dumbbell%' THEN 3 ELSE 0 END
        -- Weight plates (high confidence)
        + CASE WHEN title ILIKE '%weight plate%' OR title ILIKE '%bumper plate%' OR title ILIKE '%olympic plate%'
          OR title ILIKE '%iron plate%' OR title ILIKE '%rubber plate%' OR title ILIKE '%olympic weight%'
          OR title ILIKE '%45 lb%' OR title ILIKE '%25 lb%' THEN 3 ELSE 0 END
        -- Benches (high confidence)
        + CASE WHEN title ILIKE '%bench press%' OR title ILIKE '%weight bench%' OR title ILIKE '%adjustable bench%'
          OR title ILIKE '%incline bench%' OR title ILIKE '%decline bench%' OR title ILIKE '%utility bench%'
          OR title ILIKE '%flat bench%' OR title ILIKE '%FID bench%' OR title ILIKE '%olympic bench%' THEN 3 ELSE 0 END
        -- Specific machines (high confidence)
        + CASE WHEN title ILIKE '%hack squat%' OR title ILIKE '%leg press%' OR title ILIKE '%leg curl%'
          OR title ILIKE '%leg extension%' OR title ILIKE '%pendulum squat%' OR title ILIKE '%smith machine%'
          OR title ILIKE '%cable machine%' OR title ILIKE '%cable crossover%' OR title ILIKE '%functional trainer%'
          OR title ILIKE '%lat pulldown%' OR title ILIKE '%chest press%' OR title ILIKE '%pec deck%'
          OR title ILIKE '%preacher curl%' OR title ILIKE '%calf raise%' OR title ILIKE '%hip thrust%'
          OR title ILIKE '%glute drive%' OR title ILIKE '%GHD%' OR title ILIKE '%glute ham%'
          OR title ILIKE '%reverse hyper%' OR title ILIKE '%belt squat%' OR title ILIKE '%sissy squat%'
          OR title ILIKE '%hyperextension%' OR title ILIKE '%roman chair%'
          OR title ILIKE '%chest fly%' OR title ILIKE '%pec fly%' OR title ILIKE '%rear delt%'
          OR title ILIKE '%abductor%' OR title ILIKE '%adductor%' OR title ILIKE '%ab crunch%'
          OR title ILIKE '%chest supported row%' OR title ILIKE '%seated row%'
          OR title ILIKE '%shoulder press machine%' THEN 3 ELSE 0 END
        -- Gym brands (high confidence — if you see the brand, it's gym gear)
        + CASE WHEN title ILIKE '%rogue%' OR title ILIKE '%hammer strength%' OR title ILIKE '%life fitness%'
          OR title ILIKE '%cybex%' OR title ILIKE '%precor%' OR title ILIKE '%nautilus%'
          OR title ILIKE '%technogym%' OR title ILIKE '%titan fitness%' OR title ILIKE '%rep fitness%'
          OR title ILIKE '%body solid%' OR title ILIKE '%hoist%' OR title ILIKE '%atlantis%'
          OR title ILIKE '%prime fitness%' OR title ILIKE '%strive%' OR title ILIKE '%force usa%'
          OR title ILIKE '%inspire fitness%' OR title ILIKE '%matrix fitness%'
          OR title ILIKE '%star trac%' THEN 2 ELSE 0 END
        -- Cardio equipment (medium confidence)
        + CASE WHEN title ILIKE '%treadmill%' OR title ILIKE '%elliptical%' OR title ILIKE '%stair climber%'
          OR title ILIKE '%spin bike%' OR title ILIKE '%exercise bike%' OR title ILIKE '%peloton%'
          OR title ILIKE '%assault bike%' OR title ILIKE '%echo bike%' OR title ILIKE '%air bike%'
          OR title ILIKE '%rowing machine%' OR title ILIKE '%concept 2%' OR title ILIKE '%nordictrack%'
          OR title ILIKE '%bowflex%' THEN 2 ELSE 0 END
        -- Accessories (medium confidence)
        + CASE WHEN title ILIKE '%pull up bar%' OR title ILIKE '%dip station%' OR title ILIKE '%dip bar%'
          OR title ILIKE '%resistance band%' OR title ILIKE '%cable attachment%'
          OR title ILIKE '%tricep rope%' OR title ILIKE '%mag grip%' OR title ILIKE '%lifting belt%'
          OR title ILIKE '%weight vest%' OR title ILIKE '%medicine ball%' OR title ILIKE '%slam ball%'
          OR title ILIKE '%barbell collar%' OR title ILIKE '%plyo box%' OR title ILIKE '%battle rope%'
          OR title ILIKE '%jammer arms%' OR title ILIKE '%landmine%' THEN 2 ELSE 0 END
        -- Broad/ambiguous terms (low confidence — could match non-gym items)
        + CASE WHEN title ILIKE '%gym%' OR title ILIKE '%workout%' OR title ILIKE '%fitness%'
          OR title ILIKE '%exercise%' OR title ILIKE '%weight set%' OR title ILIKE '%home gym%'
          OR title ILIKE '%weight lifting%' OR title ILIKE '%deadlift%' THEN 1 ELSE 0 END
      ) DESC, scraped_at DESC LIMIT 120`;
    } else {
      query += ` ORDER BY scraped_at DESC LIMIT 120`;
    }

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
