import { type ModelId } from "../ai-provider";
import { TEMPLATE_SYSTEM_PROMPT } from "../prompts/template-system";
import { IdManager } from "../id-manager";
import { validateTemplateJson } from "../post-processor";
import { retryWithFeedback } from "./retry";
import { generateElementJson } from "./generate-elements";
import type { SiteBlueprint, PageDef } from "../types";
import type { SiteSettingsIds } from "./site-settings-gen";

/**
 * Estimates element count based on page sections.
 */
function estimatePageElementCount(page: PageDef): number {
  return Math.max(15, page.sections.length * 5 + 5);
}

/**
 * Builds section-specific guidance for the LLM.
 */
function buildSectionGuidance(section: string, blueprint: SiteBlueprint): string {
  const sectionMap: Record<string, string> = {
    hero: "Full-height hero section with large heading, subtext, and CTA button. Use min_height vh:60-80.",
    about: "About section with heading, paragraph text, and optional image. Two-column layout on desktop.",
    features: "Features grid: 3-4 cards in a row, each with icon/image, heading, and description text.",
    services: "Services section: 3-4 service cards with headings and descriptions.",
    portfolio: "Portfolio/work grid showing project images in a 2-3 column grid.",
    testimonials: "Testimonials section with quote text, author name, and optional avatar.",
    team: "Team members grid: 3-4 cards with photos, names, and roles.",
    pricing: "Pricing table with 2-3 tiers showing plan names, prices, features, and CTA buttons.",
    cta: "Call-to-action banner with heading, subtext, and prominent button. Contrasting background.",
    contact: blueprint.hasContactForm
      ? "Contact section with a form widget (name, email, message fields) and contact info."
      : "Contact section with contact information (email, phone, address).",
    newsletter: "Newsletter signup section with heading, brief text, and email form field.",
    stats: "Statistics section with 3-4 counter widgets showing key numbers.",
    gallery: "Image gallery grid showing 4-6 images.",
    faq: "FAQ section with question headings and answer text pairs.",
    "blog-grid": "Blog section using the 'posts' widget to show recent posts in a grid.",
    partners: "Partners/clients section with an image-carousel of logos.",
    "destinations-showcase": `Showcase section using loop-carousel widget for ${blueprint.customPostTypes[0]?.label || "items"}.`,
  };

  return sectionMap[section] || `Section: ${section} — create appropriate content.`;
}

export async function generatePageContent(
  page: PageDef,
  blueprint: SiteBlueprint,
  idMgr: IdManager,
  settingsIds: SiteSettingsIds,
  templateIdMap: Record<string, number>,
  modelId: ModelId = "claude-opus-4-6"
): Promise<string> {
  const elementCount = estimatePageElementCount(page);
  const elementIds = idMgr.generateBatch(elementCount + 15);

  const colorContext = `
Custom Color IDs for __globals__:
- Background: "${settingsIds.colorIds.background}"
- Black: "${settingsIds.colorIds.black}"
- White: "${settingsIds.colorIds.white}"
System color IDs: "primary", "secondary", "text", "accent"
`;

  const siteContext = `
Site: "${blueprint.name}" — ${blueprint.description}
Colors: primary=${blueprint.colors.primary}, secondary=${blueprint.colors.secondary}, accent=${blueprint.colors.accent}, background=${blueprint.colors.background}, text=${blueprint.colors.text}
Heading Font: ${blueprint.typography.headingFont}
Body Font: ${blueprint.typography.bodyFont}
`;

  const loopItemIds = Object.entries(templateIdMap)
    .filter(([key]) => key.includes("Loop"))
    .map(([key, id]) => `- ${key}: template_id=${id}`)
    .join("\n");

  const sectionsGuide = page.sections
    .map((s, i) => `${i + 1}. ${s}: ${buildSectionGuidance(s, blueprint)}`)
    .join("\n");

  return retryWithFeedback(async (attempt, previousError) => {
    let errorFeedback = "";
    if (previousError) {
      errorFeedback = `\n\n⚠️ PREVIOUS ATTEMPT FAILED: ${previousError}\nPlease fix this issue.`;
    }

    const prompt = `${siteContext}
${colorContext}

Pre-allocated element IDs (use IN ORDER, do not skip or invent):
${elementIds.map((id, i) => `${i + 1}. ${id}`).join("\n")}

${loopItemIds ? `Available loop item templates:\n${loopItemIds}\n` : ""}

Generate the PAGE CONTENT for: "${page.title}" (${page.isHome ? "HOME page" : "inner page"})

Build these sections in order:
${sectionsGuide}

Each section should be a top-level container (isInner: false) with appropriate inner containers and widgets.
Alternate background colors between sections for visual separation.
Use placeholder images from https://placehold.co/WIDTHxHEIGHT.
Make content realistic and relevant to "${blueprint.name}".

The output JSON must have this wrapper:
{
  "content": [ ...all section containers... ],
  "settings": {},
  "metadata": []
}${errorFeedback}`;

    const rawObject = await generateElementJson(modelId, TEMPLATE_SYSTEM_PROMPT, prompt);
    const cleaned = JSON.stringify(rawObject);
    const validation = validateTemplateJson(cleaned);

    if (!validation.valid) {
      console.error("Validation error for object:", rawObject);
      throw new Error(`Page content validation failed: ${validation.error}`);
    }

    return cleaned;
  }, 3);
}
