import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { generateSiteKit } from "@/lib/generator";
import { generateLandingPage } from "@/lib/generator/landing-page-gen";
import type { SiteBlueprint, LandingPageBlueprint, GenerationMode } from "@/lib/types";
import type { ModelId } from "@/lib/ai-provider";

/**
 * POST /api/generate
 *
 * Receives an approved blueprint, starts site kit generation (non-blocking),
 * and returns a jobId for polling progress.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode: GenerationMode = body.mode || "website";
    const modelId: ModelId = body.modelId || "claude-opus-4-7";
    const jobId = randomUUID();

    if (mode === "landing-page") {
      const landingBlueprint: LandingPageBlueprint = body.blueprint;

      if (!landingBlueprint || !landingBlueprint.name || !landingBlueprint.sections) {
        return NextResponse.json(
          { error: "Invalid landing page blueprint" },
          { status: 400 }
        );
      }

      generateLandingPage(jobId, landingBlueprint, modelId).catch((err) => {
        console.error(`Background landing page generation failed for job ${jobId}:`, err);
      });
    } else {
      const blueprint: SiteBlueprint = body.blueprint;

      if (!blueprint || !blueprint.name || !blueprint.pages) {
        return NextResponse.json(
          { error: "Invalid blueprint" },
          { status: 400 }
        );
      }

      generateSiteKit(jobId, blueprint, modelId).catch((err) => {
        console.error(`Background generation failed for job ${jobId}:`, err);
      });
    }

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error("Generate API error:", error);
    return NextResponse.json(
      { error: "Failed to start generation" },
      { status: 500 }
    );
  }
}
