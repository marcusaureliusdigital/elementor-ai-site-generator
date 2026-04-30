import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/job-store";

/**
 * GET /api/status?jobId=xxx
 *
 * Returns the current progress and file statuses for a generation job.
 */
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json(
      { error: "Missing jobId parameter" },
      { status: 400 }
    );
  }

  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json(
      { error: "Job not found" },
      { status: 404 }
    );
  }

  // Return status without file contents (to keep response small)
  const files: Record<string, { status: string; label: string; error?: string }> = {};
  for (const [key, file] of Object.entries(job.files)) {
    files[key] = {
      status: file.status,
      label: file.label,
      ...(file.error && { error: file.error }),
    };
  }

  return NextResponse.json({
    status: job.status,
    progress: job.progress,
    files,
    error: job.error,
    warnings: job.warnings,
  });
}
