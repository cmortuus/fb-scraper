import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { Listing } from "@/app/lib/types";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { listings, description } = await req.json() as {
    listings: Listing[];
    description: string;
  };

  if (!listings?.length) return NextResponse.json({ listings: [] });

  const titlesText = listings
    .map((l, i) => `${i}: "${l.title}" — $${l.price ?? "?"} (${l.location})`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    tools: [
      {
        name: "filter_results",
        description: "Check every listing against every requirement the user specified and return only exact matches.",
        input_schema: {
          type: "object" as const,
          properties: {
            relevant_indices: {
              type: "array",
              items: { type: "number" },
              description: "Indices of listings that satisfy ALL of the user's requirements. When in doubt, exclude.",
            },
          },
          required: ["relevant_indices"],
        },
      },
    ],
    tool_choice: { type: "any" },
    messages: [
      {
        role: "user",
        content: `You are a strict listing filter. The user wants: "${description}"

Go through EVERY requirement in that description and check each listing against ALL of them. Only include a listing if it plausibly satisfies every single requirement.

ALWAYS EXCLUDE:
- Listings marked "for parts", "salvage", "parts only", "project", "doesn't run", "non-runner"
- Accessories, components, or sub-parts of the item (e.g. a transmission is not a car)
- Items that are clearly a different make/model/type than requested
- Listings missing a key feature explicitly requested (e.g. if user wants "soft top" and listing says nothing about a soft top, it's uncertain — exclude it)
- Listings where the title is too generic to confirm the requirements

ONLY INCLUDE listings where the title provides strong evidence that all requirements are met or likely met.

Here are the listings:
${titlesText}

Be very strict. It is better to show 2 accurate results than 10 irrelevant ones.`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json({ listings });
  }

  const { relevant_indices } = toolUse.input as { relevant_indices: number[] };
  const filtered = relevant_indices
    .filter((i) => i >= 0 && i < listings.length)
    .map((i) => listings[i]);

  console.log(`[Filter] ${listings.length} in → ${filtered.length} out`);
  return NextResponse.json({ listings: filtered });
}
