import { type ModelId } from "../ai-provider";
import { TEMPLATE_SYSTEM_PROMPT } from "../prompts/template-system";
import { IdManager } from "../id-manager";
import { cleanLlmJson, validateTemplateJson } from "../post-processor";
import { retryWithFeedback } from "./retry";
import { generateElementJson } from "./generate-elements";
import { formatMediaForPrompt } from "./media-gen";
import type { SiteBlueprint, PageDef, MediaPlan } from "../types";
import type { SiteSettingsIds } from "./site-settings-gen";

/**
 * Estimates element count based on page sections. Conversion-focused pages
 * tend to need 5–8 widgets per section (heading + sub + body + cards + CTA),
 * so we lift the multiplier vs. the old 5-per-section bar.
 */
function estimatePageElementCount(page: PageDef): number {
  return Math.max(20, page.sections.length * 7 + 10);
}

/**
 * Builds section-specific guidance for the LLM. These are conversion-focused
 * by default — every section names what it must convey, what shape it should
 * take, and which container layout fits (flex vs grid).
 */
function buildSectionGuidance(section: string, blueprint: SiteBlueprint): string {
  const sectionMap: Record<string, string> = {
    hero: "TALL hero (min_height vh:80–95). Eyebrow tag (small caps, accent color), headline with ONE italicised emphasis word that captures the brand voice, supporting paragraph (1–2 sentences), primary CTA + soft secondary affordance. Background: prefer a brand photo if Available media has one tagged role:photo; else a soft gradient using brand colors. Avoid plain solid backgrounds — the hero must feel composed.",
    about: "About section: heading, paragraph, optional secondary image. Two-column flex layout on desktop, stacked on mobile. Voice should be personal and on-brand.",
    "pain-points": "3–4 cards calling out real frustrations the visitor experiences. Each card: short heading naming the pain, 1-sentence empathetic body, optional icon. Use grid container (container_type:'grid', grid_columns_grid:3 desktop / 1 mobile).",
    benefits: "3–4 outcomes the visitor gains. Each: strong verb-led heading, one-sentence reinforcement, varied icon or image per card. Grid container, 3 columns desktop / 1 mobile.",
    features: "Features grid: 3–4 cards in a grid container (container_type:'grid', grid_columns_grid:3 / tablet:2 / mobile:1). Each card: icon or image, heading, description. Equal-height cards.",
    services: "Services grid: 3–4 service cards. Each card: heading, 2–3 sentence description, optional icon and 'Learn more' link. Grid container with 3 columns desktop / 1 mobile.",
    "how-it-works": "Numbered 3–4 step process. Each step: large numeral (h1-sized, accent color), heading, 1-sentence body. Horizontal flow on desktop (flex row), stacked on mobile.",
    portfolio: "Portfolio grid: 6 project tiles. Use grid container (container_type:'grid', grid_columns_grid:3 / mobile:1). Each tile: image, project name, brief category line.",
    "social-proof": "Social-proof block: either a logo wall (image-carousel of partner/client logos) OR a row of 3 short testimonial quotes (quote text, name, role, company). Quiet, trust-building tone.",
    testimonials: "Testimonials section: 3 testimonials with quote text, author name, optional avatar and role. Grid or carousel.",
    team: "Team grid: 3–4 cards with photos, names, and roles. Grid container 3 columns / mobile 1.",
    pricing: "Pricing table with 2–3 tiers. Each tier: plan name, price, feature list (icon-list), CTA button. Mark recommended tier with subtle highlight (border or background).",
    cta: "Call-to-action banner: heading (strong, action-led), supporting sentence, prominent primary button. Contrasting background using brand accent or primary. Wide padding.",
    contact: blueprint.hasContactForm
      ? "Contact section: two columns on desktop. Left: heading + supporting text + brand contact details (email, response-time line). Right: form widget (name, email, message). Form must use __globals__ for label/field/button colors so it inherits site styling — do NOT specify colors per-field."
      : "Contact section: heading + supporting text + brand contact details (email, response-time line, optional location).",
    newsletter: "Newsletter section: short heading, subtext explaining value, single email field + button. Tight, low-friction layout.",
    stats: "Stats row: 3–4 counter widgets showing key numbers. Use grid 4 columns desktop / 2 mobile. Each counter: ending_number, suffix (+, %, k), title.",
    gallery: "Image gallery: 4–6 images in grid container (3 columns desktop / 2 mobile). Use Available media when relevant; else placehold.co.",
    faq: "FAQ section: 5–7 question/answer pairs using a single nested-accordion widget. Brand voice in answers — anticipate real objections.",
    "blog-grid": "Blog section: heading + 'posts' widget showing 3 recent posts in a grid. skin:'cards', columns:3, excerpt:'yes'.",
    partners: "Partners/clients carousel: image-carousel widget showing 4–6 logos. autoplay 'yes', slides_to_show '4'.",
    "destinations-showcase": `Showcase section using loop-carousel widget for ${blueprint.customPostTypes[0]?.label || "items"}. Pull template_id from the available loop-item templates listed in the prompt.`,
  };

  return sectionMap[section] || `Section: ${section} — create appropriate content with brand voice. Aim for 3–5 widgets minimum.`;
}

export async function generatePageContent(
  page: PageDef,
  blueprint: SiteBlueprint,
  idMgr: IdManager,
  settingsIds: SiteSettingsIds,
  templateIdMap: Record<string, number>,
  mediaPlan: MediaPlan,
  modelId: ModelId = "claude-opus-4-7"
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
    .map(([key, id]) => `- ${key}: template_id="${id}"`)
    .join("\n");

  const sectionsGuide = page.sections
    .map((s, i) => `${i + 1}. ${s}: ${buildSectionGuidance(s, blueprint)}`)
    .join("\n");

  const mediaList = formatMediaForPrompt(mediaPlan);
  const mediaSection = mediaList ? `\n\n${mediaList}\n` : "";

  // Conversion-focused pages (home, services, about, anything that's not a
  // utility page) need a clear funnel. Identified by sections — utility pages
  // tend to be just `[contact]` or `[hero, contact]`.
  const isConversionPage = page.sections.length >= 5 && !page.sections.every((s) =>
    ["contact", "newsletter", "hero"].includes(s)
  );
  const conversionGuidance = isConversionPage
    ? `\n\nConversion structure: this page must move the visitor through Pain → Benefit → Proof → CTA. Sections are listed in the order the planner chose, but ensure the page ends with at least one explicit CTA section before the footer (cta, contact, or newsletter). Copy must be specific, on-brand, and address real objections — no filler "Lorem ipsum" or generic SaaS-speak.`
    : "";

  return retryWithFeedback(async (attempt, previousError) => {
    let errorFeedback = "";
    if (previousError) {
      errorFeedback = `\n\n⚠️ PREVIOUS ATTEMPT FAILED: ${previousError}\nPlease fix this issue.`;
    }

    const prompt = `${siteContext}
${colorContext}

Pre-allocated element IDs (use IN ORDER, do not skip or invent):
${elementIds.map((id, i) => `${i + 1}. ${id}`).join("\n")}

${loopItemIds ? `Available loop item templates:\n${loopItemIds}\n` : ""}${mediaSection}
Generate the PAGE CONTENT for: "${page.title}" (${page.isHome ? "HOME page" : "inner page"})

Build these sections in order:
${sectionsGuide}

Each section is a top-level container (isInner: false). Inside each section use the wrapper pattern: full-bleed outer container with brand-appropriate background, then an inner container with css_classes:"wrapper" and content_width:"boxed" to constrain max-width.

Alternate background tone between consecutive sections (e.g. light → tinted → light) for visual rhythm — avoid five solid-white sections in a row.

For multi-column layouts (cards, tiles, equal-height columns) USE a grid container — set container_type:"grid", presetTitle:"Grid", presetIcon:"eicon-container-grid", grid_columns_grid:{unit:"fr", size:N, sizes:[]}, grid_gaps:{column:"24", row:"24", isLinked:true, unit:"px"}, grid_columns_grid_tablet:{unit:"fr", size:2, sizes:[]}, grid_columns_grid_mobile:{unit:"fr", size:1, sizes:[]}. Use flex (default) for hero, CTA banners, asymmetric layouts.

For images, prefer Available media listed above (real attachments) over placehold.co. Use placehold.co only when no listed media fits.${conversionGuidance}

Make content realistic and relevant to "${blueprint.name}" — pull the brand voice and copy details from the brand book in the system prompt.

The output JSON must have this wrapper:
{
  "content": [ ...all section containers... ],
  "settings": {},
  "metadata": []
}${errorFeedback}`;

    const rawObject = await generateElementJson(modelId, TEMPLATE_SYSTEM_PROMPT, prompt);
    const cleaned = cleanLlmJson(JSON.stringify(rawObject));
    const validation = validateTemplateJson(cleaned);

    if (!validation.valid) {
      console.error("Validation error for object:", rawObject);
      throw new Error(`Page content validation failed: ${validation.error}`);
    }

    // Force the page-level wrapper to match what Elementor's reference exports
    // ship: settings.template + hide_title control whether WP renders the page
    // through the Elementor canvas (full-bleed, no theme template) or falls
    // back to the theme's page.php (which renders the empty post_content,
    // hiding all our Elementor data).
    const finalObj = JSON.parse(cleaned) as {
      content: unknown[];
      settings?: unknown;
      metadata?: unknown;
    };
    finalObj.settings = { template: "default", hide_title: "yes" };
    finalObj.metadata = [];
    return JSON.stringify(finalObj);
  }, 3);
}
