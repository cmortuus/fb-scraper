import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { SavedSearch } from "@/app/lib/microcenter";

const DATA_FILE = path.join(process.cwd(), "data", "saved-searches.json");

function load(): SavedSearch[] {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function save(searches: SavedSearch[]) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(searches, null, 2));
}

export async function GET() {
  return NextResponse.json(load());
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Omit<SavedSearch, "id" | "createdAt">;
  const searches = load();
  const newSearch: SavedSearch = {
    ...body,
    id: Date.now().toString(),
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
