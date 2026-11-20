// /src/app/api/cron/ship-file-pickup/route.js
// Called by the database scheduler (see Settings -> Scheduler). Needs the scheduler's login.
import { NextResponse } from "next/server";
import { cronAuthorized, runJob } from "@/lib/scheduledJobs";

export const maxDuration = 60;

async function run(request) {
  if (!(await cronAuthorized(request))) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const result = await runJob("ship_file_pickup", request.headers.get("x-trigger") === "schedule" ? "schedule" : "external");
  return NextResponse.json({ success: result.ok, ...result }, { status: result.ok ? 200 : 500 });
}

export const GET = run;
export const POST = run;
