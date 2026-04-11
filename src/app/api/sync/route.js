// /src/app/api/sync/route.js
// Deprecated — use /api/sync/all instead.
// Kept as a redirect so any existing calls don't hard-break.
import { NextResponse } from "next/server";

export async function POST(request) {
  const url = new URL(request.url);
  url.pathname = "/api/sync/all";
  return NextResponse.redirect(url, { status: 308 });
}
