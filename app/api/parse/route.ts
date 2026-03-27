import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { CATEGORIES } from "@/app/lib/categories";
import type { SearchParams } from "@/app/lib/types";
import { CLAUDE_MODEL } from "@/app/lib/config";

const client = new Anthropic();

const categoryLabels = CATEGORIES.map((c) => c.label);

export async function POST(req: NextRequest) {
  const { description } = await req.json();

  if (!description?.trim()) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }
  if (description.length > 1000) {
    return NextResponse.json({ error: "Description must be 1000 characters or fewer" }, { status: 400 });
  }

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 256,
    tools: [
      {
        name: "extract_search_params",
        description: "Extract structured search parameters from a natural language description of a used item the user wants to find.",
        input_schema: {
          type: "object" as const,
          properties: {
            keywords: {
              type: "string",
              description: "The search query to use. Include ALL specific features, body styles, drivetrain types, and distinguishing attributes the user mentioned. Do NOT drop important qualifiers. E.g. 'RAV4 soft top 4WD manual' or 'Honda Civic manual transmission 2018'.",
            },
            category: {
              type: "string",
              enum: categoryLabels,
              description: "The best matching category from the list.",
            },
            minPrice: {
              type: "number",
              description: "Minimum price in USD if mentioned, otherwise omit.",
            },
            maxPrice: {
              type: "number",
              description: "Maximum price in USD if mentioned, otherwise omit.",
            },
            location: {
              type: "string",
              description: "City name if a location is mentioned. Always use the city name, never a zip code (e.g. if user says '21133' infer 'Baltimore'; if 'near me' or 'entire US' or no location, omit). E.g. 'Seattle' or 'Los Angeles'.",
            },
            condition: {
              type: "string",
              description: "Condition preference if mentioned: 'excellent', 'good', 'fair', 'any'. Default to 'any'.",
            },
            radiusMiles: {
              type: "number",
              description: "Search radius in miles if mentioned (e.g. 'within 50 miles', 'nearby'). Common values: 10, 25, 50, 100. Omit if not mentioned.",
            },
          },
          required: ["keywords", "category"],
        },
      },
    ],
    tool_choice: { type: "any" },
    messages: [
      {
        role: "user",
        content: `Extract search parameters from this description of a used item someone wants to buy:\n\n"${description}"\n\nIMPORTANT: Keep ALL specific features in the keywords field (body style, drivetrain, transmission, special features, etc.). Do not drop any distinguishing attributes. For location, always use the city name (not zip codes). If user says "entire US", "anywhere", or "nationwide", omit location entirely.`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json({ error: "Failed to parse description" }, { status: 500 });
  }

  const parsed = toolUse.input as {
    keywords: string;
    category: string;
    minPrice?: number;
    maxPrice?: number;
    location?: string;
    condition?: string;
    radiusMiles?: number;
  };

  const category = CATEGORIES.find((c) => c.label === parsed.category) ?? CATEGORIES[CATEGORIES.length - 1];

  const params: SearchParams = {
    keywords: parsed.keywords,
    craigslistCategory: category.craigslistCode,
    ebayCategoryId: category.ebayCategoryId,
    minPrice: parsed.minPrice,
    maxPrice: parsed.maxPrice,
    location: parsed.location,
    condition: parsed.condition,
    radiusMiles: parsed.radiusMiles,
  };

  return NextResponse.json({ params, categoryLabel: category.label });
}
