// /src/app/api/cron/sftp-status/route.js
// Hourly sweep of SFTP files we delivered. Called by a scheduler with the CRON_SECRET.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { refreshAllSftpStatus } from "@/lib/sftp";
import { logError } from "@/lib/logError";

export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await refreshAllSftpStatus();
    return NextResponse.json({ success: true, ...summary });
  } catch (err) {
    await logError({ source: "api/cron/sftp-status", error: err });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
