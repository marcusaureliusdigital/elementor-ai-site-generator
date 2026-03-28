/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateText } from "ai";
import { getModel, type ModelId } from "../ai-provider";
import { LANDING_CONTENT_SYSTEM_PROMPT } from "../prompts/landing-content-system";
import { IdManager } from "../id-manager";
import { validateTemplateJson } from "../post-processor";
import { retryWithFeedback } from "./retry";
import {
  MARCUS_AURELIUS_BRAND,
  FRONTEND_DESIGN,
  BRAND_VOICE,
  BACKGROUND_TEXTURE_BASE64,
  LOGO_WHITE_NOISE_BASE64,
} from "../brand";
import {
  createJob,
  getJob,
  setJobStatus,
  registerFile,
  setFileContent,
  setFileError,
  setFileGenerating,
  updateFile,
} from "../job-store";
import type { LandingPageBlueprint, SiteBlueprint } from "../types";

/**
 * Section-specific guidance — tells the LLM which widgets, layout, and wrapper pattern to use.
 * Every section follows: top-level (isInner: false) → wrapper (isInner: true, css_classes: "wrapper") → content.
 */
function buildSectionGuidance(section: string, blueprint: LandingPageBlueprint): string {
  const sectionMap: Record<string, string> = {
    header: `HEADER: Top-level container (isInner: false, column, padding: 0).
  → Wrapper container (isInner: true, css_classes: "wrapper", ROW, space-between, align-items: center, min_height: {unit:"px",size:80,sizes:[]}, padding: 16px all).
    → heading widget (h3, brand name "${blueprint.name}", font_weight: 700)
    → icon-list widget (4-5 nav links, view: "inline", space_between: 32px)
    → button widget (small CTA, accent background ${blueprint.colors.accent || blueprint.colors.primary})
  Navigation Rule: Use icon-list with view:"inline" for nav links, NOT multiple buttons.`,

    hero: `HERO: Top-level container (isInner: false, column, center, padding: 100px top/bottom 16px sides).
  → Wrapper container (isInner: true, css_classes: "wrapper", column, center, gap: 32).
    → heading widget (h1, bold, use <span style="color:${blueprint.colors.primary}">keyword</span> for emphasis)
    → text-editor widget (subtitle paragraph, muted color)
    → Container (row, gap: 16) for button group:
      → button widget (primary CTA, background: ${blueprint.colors.primary}, white text, large padding 16px/32px, border_radius: 12px)
      → button widget (secondary CTA, outlined or lighter style)
    → image widget (hero image, https://placehold.co/1200x600, border_radius: 12px)`,

    "social-proof": `SOCIAL PROOF: Top-level container (isInner: false, column, padding: 48px top/bottom, subtle background).
  → Wrapper container (isInner: true, css_classes: "wrapper", column, center, gap: 24).
    → heading widget (p or h6, "Trusted by 500+ companies" or similar, muted color, center)
    → nested-carousel widget:
      settings.carousel_items: array of 4-6 items with slide_title and _id (7-char hex)
      settings: slides_to_show "4", slides_to_scroll "1", autoplay "yes", image_spacing_custom: {unit:"px",size:32,sizes:[]}
      elements: 4-6 containers, each holding an image widget (partner logo, https://placehold.co/200x80)`,

    features: `FEATURES: Top-level container (isInner: false, column, padding: 80px top/bottom).
  → Wrapper container (isInner: true, css_classes: "wrapper", column, center, gap: 48).
    → heading widget (h2, center)
    → text-editor widget (subtitle, center, muted)
    → Container (ROW, gap: 32, flex_direction_tablet: "column"):
      → 3-4 inner containers (column, each with background_background:"classic", background_color:"#F8F8F8", border_radius: 12px, padding: 32px, box_shadow):
        → Each contains: icon-box widget (position:"top", selected_icon with relevant fas icon, title_text, description_text, primary_color: ${blueprint.colors.primary})`,

    benefits: `BENEFITS: Top-level container (isInner: false, column, padding: 80px top/bottom).
  → Wrapper container (isInner: true, css_classes: "wrapper", column, gap: 64).
    → 2-3 ROW containers (gap: 48, flex_direction_tablet: "column"):
      → Container (column, 50%) with image widget (border_radius: 12px)
      → Container (column, 50%, justify: center, gap: 16) with heading (h3) + text-editor + button
    Alternate image left/right by using flex_direction: "row-reverse" on even rows.`,

    "how-it-works": `HOW IT WORKS: Top-level container (isInner: false, column, padding: 80px top/bottom).
  → Wrapper container (isInner: true, css_classes: "wrapper", column, center, gap: 48).
    → heading widget (h2, center)
    → Container (ROW, gap: 32, flex_direction_tablet: "column"):
      → 3-4 inner containers (column, center, gap: 16):
        → heading widget (h2, accent color ${blueprint.colors.primary}, step number "01"/"02"/"03")
        → heading widget (h4, step title)
        → text-editor widget (step description)`,

    testimonials: `TESTIMONIALS: Top-level container (isInner: false, column, padding: 80px top/bottom).
  → Wrapper container (isInner: true, css_classes: "wrapper", column, gap: 48).
    → heading widget (h2, center)
    → Container (ROW, gap: 16, flex_direction_tablet: "column"):
      → 3 inner containers (column, gap: 16):
        → Each contains 1-3 testimonial widgets stacked vertically (masonry style)
        → Each testimonial: testimonial_content (2+ sentences), testimonial_name, testimonial_job, testimonial_image (https://placehold.co/100x100)`,

    stats: `STATS: Top-level container (isInner: false, column, padding: 80px top/bottom, background_background:"classic", dark background_color like ${blueprint.colors.black || "#1a1a1a"}).
  → Wrapper container (isInner: true, css_classes: "wrapper", ROW, gap: 32, justify: space-between, flex_direction_tablet: "column"):
    → 3-4 inner containers (column, center, gap: 8):
      → Each: counter widget (ending_number: realistic number, suffix: "+" or "%", title: metric label, number_color: ${blueprint.colors.white || "#FFFFFF"}, title_color: muted light)`,

    pricing: `PRICING: Top-level container (isInner: false, column, padding: 80px top/bottom).
  → Wrapper container (isInner: true, css_classes: "wrapper", column, center, gap: 48).
    → heading widget (h2, center)
    → text-editor widget (subtitle, center)
    → nested-tabs widget (Monthly / Yearly toggle):
      settings.tabs: [{tab_title:"Monthly",_id:"7hex"},{tab_title:"Yearly -20%",_id:"7hex"}]
      Style tabs: tabs_title_background_color_background:"classic", tabs_title_border_radius:32px, title_typography_typography:"custom"
      elements: 2 containers, each containing ROW container (gap: 32, flex_direction_tablet: "column") with 2-3 pricing cards.
      Each card (column container, border_radius: 12px, box_shadow, padding: 32px):
        → heading (h3, tier name) + heading (h2, "$X/mo", large font) + icon-list (5-8 features with fas fa-check) + button (CTA)
        → Highlight recommended tier with accent background_color`,

    faq: `FAQ: Top-level container (isInner: false, column, padding: 80px top/bottom).
  → Wrapper container (isInner: true, css_classes: "wrapper", column, center, gap: 48).
    → heading widget (h2, center, "Frequently Asked Questions")
    → nested-accordion widget:
      settings.tabs: 5-8 items, each with tab_title (question), _id (7-char hex), tab_icon ({value:"fas fa-plus",library:"fa-solid"}), tab_icon_active ({value:"fas fa-minus",library:"fa-solid"})
      Style: title_typography_typography:"custom", title_text_color, border_color
      elements: 5-8 containers (one per tab), each isInner:true with content_width:"full", flex_direction:"column", flex_justify_content:"flex-start", flex_align_items:"stretch", padding:16px
      Each container holds a text-editor widget with the answer paragraph.
      CRITICAL: settings.tabs count MUST equal elements count (1:1 mapping).`,

    cta: `CTA: Top-level container (isInner: false, column, center, background_background:"classic", contrasting background_color like ${blueprint.colors.primary}, padding: 100px top/bottom).
  → Wrapper container (isInner: true, css_classes: "wrapper", column, center, gap: 24).
    → heading widget (h2, ${blueprint.colors.white || "#FFFFFF"} text, compelling headline)
    → text-editor widget (subtext, lighter color)
    → button widget (large, contrasting color like ${blueprint.colors.white || "#FFFFFF"} background with ${blueprint.colors.primary} text, border_radius: 12px)`,

    newsletter: `NEWSLETTER: Top-level container (isInner: false, column, padding: 80px top/bottom).
  → Wrapper container (isInner: true, css_classes: "wrapper", column, center, gap: 24).
    → heading widget (h2, center)
    → text-editor widget (brief description, center)
    → form widget: single email field (field_type:"email") + submit button (button_text:"Subscribe", button_background_color: ${blueprint.colors.primary})
    Style form: field_background_color, field_border_color, button_text_color: "#FFFFFF"`,

    contact: blueprint.hasContactForm
      ? `CONTACT: Top-level container (isInner: false, column, padding: 80px top/bottom).
  → Wrapper container (isInner: true, css_classes: "wrapper", column, gap: 48).
    → heading widget (h2, center)
    → Container (ROW, gap: 32, flex_direction_tablet: "column"):
      → Container (column, 60%) with form widget:
        form_fields: [name 50%, email 50%, message 100% textarea], button_text:"Send Message", button_size:"lg"
        Style: label_color, field_background_color:"#FFFFFF", field_border_color:"#E0E0E0", button_background_color: ${blueprint.colors.primary}, button_text_color:"#FFFFFF"
      → Container (column, 40%) with heading (h3, "Get in Touch") + text-editor (email, phone, address details) + icon-list (contact items with icons)`
      : `CONTACT: Top-level container (isInner: false, column, padding: 80px top/bottom).
  → Wrapper container (isInner: true, css_classes: "wrapper", column, center, gap: 24).
    → heading widget (h2, center)
    → text-editor widget (email, phone, address)
    → image widget (map placeholder, https://placehold.co/800x400)`,

    gallery: `GALLERY: Top-level container (isInner: false, column, padding: 80px top/bottom).
  → Wrapper container (isInner: true, css_classes: "wrapper", column, center, gap: 48).
    → heading widget (h2, center)
    → Container (ROW, gap: 16, flex_wrap: "wrap"):
      → 4-6 inner containers each with image widget (border_radius: 12px, consistent sizing like https://placehold.co/400x300)`,

    footer: `FOOTER: Top-level container (isInner: false, column, background_background:"classic", dark background_color like ${blueprint.colors.black || "#1a1a1a"}, padding: 48px top/bottom 16px sides).
  → Wrapper container (isInner: true, css_classes: "wrapper", column, gap: 32).
    → Container (ROW, space-between, flex_direction_tablet: "column"):
      → heading widget (h4, brand name "${blueprint.name}", ${blueprint.colors.white || "#FFFFFF"} text)
      → icon-list widget (social links, view: "inline", white icon_color)
    → divider widget (muted color, subtle)
    → text-editor widget (copyright "© 2026 ${blueprint.name}. All rights reserved.", center, muted gray, small font)`,
  };

  return sectionMap[section] || `Section: ${section} — Build as a top-level container (isInner: false) → wrapper container (isInner: true, css_classes: "wrapper") → appropriate content widgets. Follow the system prompt layout recipes.`;
}

/**
 * Extract JSON from LLM response text — handles markdown code fences and raw JSON.
 */
function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0].trim();

  return text.trim();
}

/**
 * Walk the element tree and fix IDs, structure, and activation keys:
 * - Replace invalid/duplicate IDs with unused pre-allocated IDs
 * - Ensure every widget has elements: []
 * - Ensure every element has a settings object
 * - Add background_background: "classic" where missing
 * - Add typography_typography: "custom" where missing
 */
function postProcessElements(
  elements: any[],
  allocatedIds: string[],
  usedIds: Set<string>
): void {
  const idPattern = /^[0-9a-f]{7,8}$/;


  for (const el of elements) {
    // Fix missing or invalid IDs
    if (!el.id || !idPattern.test(el.id) || usedIds.has(el.id)) {
      const nextId = allocatedIds.find((id) => !usedIds.has(id));
      if (nextId) {
        el.id = nextId;
      }
    }
    usedIds.add(el.id);

    // Ensure settings is an object
    if (!el.settings || typeof el.settings !== "object") {
      el.settings = {};
    }

    // Ensure elements array exists
    if (!Array.isArray(el.elements)) {
      el.elements = [];
    }

    // For containers: ensure background activation
    if (el.elType === "container" && el.settings.background_color && !el.settings.background_background) {
      el.settings.background_background = "classic";
    }

    // For all elements: ensure typography activation
    const settings = el.settings;
    const typoKeys = Object.keys(settings).filter(
      (k) => (k.endsWith("_font_family") || k.endsWith("_font_size") || k.endsWith("_font_weight")) && !k.endsWith("_typography")
    );
    for (const key of typoKeys) {
      // Extract the prefix: e.g., "typography_font_family" → "typography", "title_typography_font_family" → "title_typography"
      const parts = key.split("_font_");
      if (parts.length === 2) {
        const activationKey = parts[0] + "_typography";
        // Only add if the activation key is a typography activation (ends with _typography)
        if (activationKey.endsWith("_typography") && !settings[activationKey]) {
          settings[activationKey] = "custom";
        }
      }
    }

    // Normalize flex_gap: ensure isLinked, unit, size are present
    if (settings.flex_gap && typeof settings.flex_gap === "object") {
      const gap = settings.flex_gap;
      if (gap.column !== undefined) {
        if (gap.isLinked === undefined) gap.isLinked = true;
        if (gap.unit === undefined) gap.unit = "px";
        if (gap.size === undefined) gap.size = parseInt(gap.column) || 0;
      }
    }

    // Normalize size objects: add sizes: [] where missing
    for (const val of Object.values(settings)) {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        const obj = val as Record<string, any>;
        if ("unit" in obj && "size" in obj && !("top" in obj) && !("sizes" in obj)) {
          obj.sizes = [];
        }
      }
    }

    // Recurse into children (containers and nested widgets)
    if (el.elements.length > 0) {
      postProcessElements(el.elements, allocatedIds, usedIds);
    }
  }
}

/**
 * Generates a complete Elementor landing page from a LandingPageBlueprint.
 * Uses generateText + JSON parsing (compatible with all providers including Gemini).
 * Single LLM call — no templates, no WXR, no manifest.
 */
export async function generateLandingPage(
  jobId: string,
  blueprint: LandingPageBlueprint,
  modelId: ModelId = "claude-opus-4-6"
): Promise<void> {
  // Create job with a dummy SiteBlueprint for backward compat
  const dummyBlueprint: SiteBlueprint = {
    name: blueprint.name,
    slug: blueprint.slug,
    title: blueprint.title,
    description: blueprint.description,
    siteUrl: "https://example.com",
    author: { name: "Admin", login: "admin", email: "admin@example.com" },
    colors: blueprint.colors,
    typography: blueprint.typography,
    pages: [],
    posts: [],
    customPostTypes: [],
    categories: [],
    templates: [],
    plugins: [],
    hasContactForm: blueprint.hasContactForm,
    hasBlog: false,
    socialLinks: blueprint.socialLinks,
  };

  createJob(jobId, dummyBlueprint, "landing-page", blueprint);

  // Register section-level files for visual progress
  const sectionKeys = blueprint.sections.map((s) => `landing-section:${s}`);
  const sectionLabels: Record<string, string> = {
    header: "Header",
    hero: "Hero Section",
    "social-proof": "Social Proof",
    features: "Features",
    benefits: "Benefits",
    "how-it-works": "How It Works",
    testimonials: "Testimonials",
    stats: "Statistics",
    pricing: "Pricing Table",
    faq: "FAQ Section",
    cta: "Call to Action",
    newsletter: "Newsletter",
    contact: "Contact Form",
    gallery: "Gallery",
    footer: "Footer",
  };

  for (const section of blueprint.sections) {
    const key = `landing-section:${section}`;
    const label = sectionLabels[section] || section.charAt(0).toUpperCase() + section.slice(1);
    registerFile(jobId, key, label);
  }
  // Final combined file (used for download)
  registerFile(jobId, "landing-page", "Assembling Landing Page");

  setJobStatus(jobId, "generating");

  // Start simulated section progress — cycle through sections every 3s
  let progressIndex = 0;
  setFileGenerating(jobId, sectionKeys[0]);
  const progressTimer = setInterval(() => {
    progressIndex++;
    if (progressIndex < sectionKeys.length) {
      // Mark previous as done, next as generating
      updateFile(jobId, sectionKeys[progressIndex - 1], { status: "done" });
      setFileGenerating(jobId, sectionKeys[progressIndex]);
    }
  }, 3000);

  try {
    const idMgr = new IdManager(10);
    // Landing pages need many IDs (80-200 elements typical with nested widgets)
    const elementIds = idMgr.generateBatch(200);

    const siteContext = `
Landing Page: "${blueprint.name}" — ${blueprint.description}

Brand DNA:
- Primary: ${blueprint.colors.primary}
- Secondary: ${blueprint.colors.secondary}
- Accent: ${blueprint.colors.accent}
- Background: ${blueprint.colors.background}
- Text: ${blueprint.colors.text}
- Black: ${blueprint.colors.black}
- White: ${blueprint.colors.white}
- Heading Font: ${blueprint.typography.headingFont}
- Body Font: ${blueprint.typography.bodyFont}
`;

    const sectionsGuide = blueprint.sections
      .map((s, i) => `${i + 1}. ${buildSectionGuidance(s, blueprint)}`)
      .join("\n\n");

    const content = await retryWithFeedback(async (attempt, previousError) => {
      let errorFeedback = "";
      if (previousError) {
        errorFeedback = `\n\n⚠️ PREVIOUS ATTEMPT FAILED: ${previousError}\nPlease fix this issue.`;
      }

      const prompt = `${siteContext}

Pre-allocated element IDs (use IN ORDER, do not skip or invent):
${elementIds.map((id, i) => `${i + 1}. ${id}`).join("\n")}

Generate a COMPLETE, HIGH-CONVERTING LANDING PAGE with these sections in order. Each section description tells you EXACTLY which widgets, layout, and structure to use — follow them precisely:

${sectionsGuide}

CRITICAL REQUIREMENTS:
- WRAPPER PATTERN: Every section = top-level container (isInner: false, full-width backgrounds) → inner wrapper container (isInner: true, css_classes: "wrapper") → content
- Use SPECIFIC widget types listed for each section (icon-box for features, nested-accordion for FAQ, counter for stats, testimonial for reviews, form for contact, nested-carousel for logos, nested-tabs for pricing)
- NEVER use legacy widgets: accordion, image-carousel, tabs — use nested-accordion, nested-carousel, nested-tabs
- BACKGROUND ACTIVATION: Set "background_background": "classic" BEFORE "background_color" on ALL containers with backgrounds
- TYPOGRAPHY ACTIVATION: Set "typography_typography": "custom" BEFORE any typography_font_family, typography_font_size, etc.
- All containers: content_width: "full", flex_gap: { "column": "32", "row": "32", "isLinked": true, "unit": "px", "size": 32 }
- Multi-column: parent flex_direction: "row" → children as columns. Always add flex_direction_tablet: "column"
- All dimension objects (width, min_height, font sizes): MUST include "sizes": []
- All colors: direct hex values, no __globals__. All content is static.
- Alternate background colors between sections for visual separation
- Use https://placehold.co/WIDTHxHEIGHT for placeholder images with descriptive alt text
- Make content realistic and compelling for "${blueprint.name}"
- Include at least 5-6 CTA buttons throughout the page
- Generate at least 80 elements total for a rich, complete page
- Use <span style="color:${blueprint.colors.primary}">keyword</span> in headings for emphasis

CUSTOM CSS: Generate a custom_css string in page_settings that includes:
- .wrapper { width: 100%; max-width: 1200px; margin-left: auto; margin-right: auto; }
- body styles with font-family: '${blueprint.typography.bodyFont}', color: ${blueprint.colors.text}
- h1-h6 resets with font-family: '${blueprint.typography.headingFont}', clamp() fluid sizes, font-weight: 700
- .brand-color { color: ${blueprint.colors.primary}; }
- .highlighted class with pseudo-element underline effect using ${blueprint.colors.primary}
- .desktop-only / .tablet-mobile-only responsive visibility
- p:last-child { margin-bottom: 0; }
- At least one creative CSS detail (gradient, blur, animation)

NESTED WIDGETS: For nested-accordion, nested-tabs, nested-carousel:
- settings.tabs (or settings.carousel_items) count MUST EQUAL elements[] count (1:1 mapping)
- Each child in elements[] must be a container (elType: "container", isInner: true) with proper flex settings
- _id fields in settings.tabs/carousel_items: use any 7-char hex string (NOT from pre-allocated list)

Return ONLY valid JSON with this exact wrapper:
{
  "content": [ ...all section containers... ],
  "page_settings": { "hide_title": "yes", "custom_css": "...your CSS string..." },
  "version": "0.4",
  "title": "${blueprint.title}",
  "type": "page"
}

Each element:
{
  "id": "8-char-hex from pre-allocated list",
  "elType": "container" or "widget",
  "isInner": true/false (boolean),
  "widgetType": "widget-type" (only for widgets),
  "settings": { ...settings as object... },
  "elements": [ ...children... ]
}

Return ONLY the JSON. No markdown, no explanation, no code fences.${errorFeedback}`;

      // Build the full system prompt with brand assets prepended
      const fullSystemPrompt = [
        "# Brand Identity & Design Guidelines\n",
        MARCUS_AURELIUS_BRAND,
        "\n\n# Frontend Design Guidelines\n",
        FRONTEND_DESIGN,
        "\n\n# Brand Voice Profile\n",
        BRAND_VOICE,
        "\n\n---\n\n# Elementor Landing Page Builder Instructions\n",
        LANDING_CONTENT_SYSTEM_PROMPT,
      ].join("");

      // For Claude: include brand asset images as reference via messages array
      // For Gemini: text-only (Gemini uses different image format)
      const isClaude = modelId.startsWith("claude");

      const { text } = await generateText({
        model: getModel(modelId),
        system: fullSystemPrompt,
        messages: [
          {
            role: "user",
            content: isClaude
              ? [
                  {
                    type: "image" as const,
                    image: BACKGROUND_TEXTURE_BASE64,
                    mediaType: "image/png",
                  },
                  {
                    type: "image" as const,
                    image: LOGO_WHITE_NOISE_BASE64,
                    mediaType: "image/png",
                  },
                  {
                    type: "text" as const,
                    text: "Above: (1) The brand's signature background texture — dark noise gradient with warm gold glow and forest-green tint. Replicate this atmosphere in the landing page design via custom_css. (2) The brand logo — white noise texture on black. Use as visual reference for the brand aesthetic.\n\n" + prompt,
                  },
                ]
              : [
                  {
                    type: "text" as const,
                    text: prompt,
                  },
                ],
          },
        ],
      });

      // Parse the JSON response
      const jsonStr = extractJson(text);
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        throw new Error(`Invalid JSON response from LLM: ${(e as Error).message}`);
      }

      // Ensure required wrapper fields
      const finalObj = {
        content: parsed.content || [],
        page_settings: parsed.page_settings || { hide_title: "yes" },
        version: parsed.version || "0.4",
        title: parsed.title || blueprint.title,
        type: parsed.type || "page",
      };

      if (!Array.isArray(finalObj.content) || finalObj.content.length === 0) {
        throw new Error("Landing page has no content sections");
      }

      // Post-process: fix IDs, activation keys, data formats
      const usedIds = new Set<string>();
      postProcessElements(finalObj.content, elementIds, usedIds);

      const cleaned = JSON.stringify(finalObj);

      // Validate the content portion
      const contentValidation = validateTemplateJson(
        JSON.stringify({ content: finalObj.content, settings: {}, metadata: [] })
      );

      if (!contentValidation.valid) {
        throw new Error(`Landing page validation failed: ${contentValidation.error}`);
      }

      return cleaned;
    }, 3);

    // Stop progress timer and mark all sections done
    clearInterval(progressTimer);
    for (const key of sectionKeys) {
      updateFile(jobId, key, { status: "done" });
    }

    setFileContent(jobId, "landing-page", content);
    setJobStatus(jobId, "complete");
  } catch (error) {
    clearInterval(progressTimer);
    const msg = error instanceof Error ? error.message : String(error);

    // Mark remaining sections as error
    const job = getJob(jobId);
    for (const key of sectionKeys) {
      if (job?.files[key]?.status !== "done") {
        setFileError(jobId, key, msg);
      }
    }

    setFileError(jobId, "landing-page", msg);
    setJobStatus(jobId, "error", msg);
    console.error("Landing page generation failed:", msg);
  }
}
