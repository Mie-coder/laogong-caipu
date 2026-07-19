import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
}
