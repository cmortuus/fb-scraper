import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { SavedFinderSearch } from "@/app/lib/saved-finder-searches";

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

export async function GET() {
  return NextResponse.json(load());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name?.trim() || !body.description?.trim() || !body.email?.trim()) {
    return NextResponse.json({ error: "name, description, and email are required" }, { status: 400 });
  }

  const searches = load();
  const newSearch: SavedFinderSearch = {
    id: Date.now().toString(),
    name: body.name.trim(),
    description: body.description.trim(),
    email: body.email.trim(),
    location: body.location?.trim() || undefined,
    radiusMiles: body.radiusMiles || undefined,
    createdAt: new Date().toISOString(),
  };
  searches.push(newSearch);
  save(searches);
  return NextResponse.json(newSearch);
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  const searches = load().filter((s) => s.id !== id);
  save(searches);
  return NextResponse.json({ ok: true });
}
