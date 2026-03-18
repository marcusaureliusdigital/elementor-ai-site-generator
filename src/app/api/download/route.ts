import { NextRequest, NextResponse } from "next/server";
import { getJob, collectFiles } from "@/lib/job-store";
import { bundleSiteKit } from "@/lib/zip-bundler";
import type { SiteKitFiles } from "@/lib/types";

/**
 * GET /api/download?jobId=xxx
 *
 * For full websites: assembles completed job files into a Site Kit .zip.
 * For landing pages: returns the single JSON file directly.
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

  if (job.status !== "complete") {
    return NextResponse.json(
      { error: "Job not yet complete", status: job.status },
      { status: 400 }
    );
  }

  const allFiles = collectFiles(jobId);
  if (!allFiles) {
    return NextResponse.json(
      { error: "Failed to collect files" },
      { status: 500 }
    );
  }

  // ── Landing Page Mode: return single JSON ──────────────────────
  if (job.mode === "landing-page") {
    const landingContent = allFiles["landing-page"] || "{}";
    const slug = job.landingBlueprint?.slug || job.blueprint?.slug || "landing-page";
    const filename = `${slug}-landing-page.json`;

    return new NextResponse(landingContent, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // ── Full Website Mode: return zip ──────────────────────────────
  const siteKitFiles: SiteKitFiles = {
    manifest: allFiles["manifest"] || "{}",
    siteSettings: allFiles["site-settings"] || "{}",
    customCode: allFiles["custom-code"] || "[]",
    customFonts: allFiles["custom-fonts"] || "[]",
    templates: {},
    taxonomies: {},
    contentPages: {},
    wpContent: {},
  };

  for (const [key, content] of Object.entries(allFiles)) {
    if (key.startsWith("template:")) {
      const id = key.replace("template:", "");
      siteKitFiles.templates[id] = content;
    } else if (key.startsWith("tax:")) {
      const name = key.replace("tax:", "");
      siteKitFiles.taxonomies[name] = content;
    } else if (key.startsWith("page:")) {
      const id = key.replace("page:", "");
      siteKitFiles.contentPages[id] = content;
    } else if (key.startsWith("wxr:")) {
      const type = key.replace("wxr:", "");
      siteKitFiles.wpContent[`${type}/${type}`] = content;
    }
  }

  const buffer = await bundleSiteKit(siteKitFiles);
  const filename = `${job.blueprint.slug || "site"}-kit.zip`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.byteLength.toString(),
    },
  });
}
