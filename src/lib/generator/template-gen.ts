import type { ModelId } from "../ai-provider";
import { TEMPLATE_SYSTEM_PROMPT } from "../prompts/template-system";
import { IdManager } from "../id-manager";
import { cleanLlmJson, validateTemplateJson } from "../post-processor";
import { retryWithFeedback } from "./retry";
import { generateElementJson } from "./generate-elements";
import { formatMediaForPrompt } from "./media-gen";
import type { SiteBlueprint, TemplateDef, MediaPlan } from "../types";
import type { SiteSettingsIds } from "./site-settings-gen";

// ── Prompt Builders ──────────────────────────────────────────────

/**
 * Find the loop-item template that matches the given archive template.
 * Convention from the planner: archive titled "Blog Archive" pairs with
 * "Post Loop Item"; CPT archive "<Label> Archive" pairs with
 * "<SingularLabel> Loop Item".
 */
function findLoopItemForArchive(
  archive: TemplateDef,
  blueprint: SiteBlueprint,
  templateIdMap: Record<string, number>
): { id: number; title: string } | undefined {
  // Blog archive
  if (archive.title.toLowerCase().includes("blog")) {
    const id = templateIdMap["Post Loop Item"];
    if (id) return { id, title: "Post Loop Item" };
  }
  // CPT archive — match on the CPT singular label
  for (const cpt of blueprint.customPostTypes) {
    if (archive.title.toLowerCase().includes(cpt.label.toLowerCase())) {
      const matchTitle = `${cpt.singularLabel} Loop Item`;
      const id = templateIdMap[matchTitle];
      if (id) return { id, title: matchTitle };
    }
  }
  return undefined;
}

function buildTemplatePrompt(
  template: TemplateDef,
  blueprint: SiteBlueprint,
  elementIds: string[],
  settingsIds: SiteSettingsIds,
  templateIdMap: Record<string, number>,
  mediaPlan: MediaPlan,
  previousError?: string
): string {
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
Pages: ${blueprint.pages.map((p) => p.title).join(", ")}
${blueprint.customPostTypes.length > 0 ? `CPTs: ${blueprint.customPostTypes.map((c) => c.label).join(", ")}` : ""}
`;

  const idList = `
Pre-allocated element IDs (use IN ORDER, do not skip or invent):
${elementIds.map((id, i) => `${i + 1}. ${id}`).join("\n")}
`;

  const mediaList = formatMediaForPrompt(mediaPlan);

  let typeSpecificPrompt = "";

  switch (template.docType) {
    case "header": {
      // Header gets the logo attachment so theme-site-logo resolves to a real
      // image. When there's no logo we still emit the widget — WP will fall
      // back to the site title text.
      const logoNote = mediaPlan.logoAttachmentId
        ? `Logo attachment: id ${mediaPlan.logoAttachmentId}. The theme-site-logo widget pulls from WP's customizer (custom_logo), which is already wired to this attachment in site-settings.json — just emit the widget.`
        : "No logo attachment available — emit theme-site-logo widget anyway; WP will fall back to site title text.";
      typeSpecificPrompt = `Generate a HEADER template that feels intentional, not generic. Use this structure:

1. Top-level container: full-width (content_width: "full"), row direction, sticky background (background_color via __globals__ to "${settingsIds.colorIds.white}" or transparent), padding ~16-24px vertical.
2. Inner wrapper container (isInner: true, css_classes: "wrapper") to constrain max-width — boxed content_width.
3. Inside the wrapper, a row with three regions:
   - Left: theme-site-logo widget. Width 120-160px on desktop. ${logoNote}
   - Center or right: nav-menu widget with menu: "main-menu". Use brand typography for menu items: typography_typography "custom", typography_font_family matches the brand body font, typography_font_weight "500" or "600", typography_text_transform "uppercase" or "none" depending on brand tone. Set pointer to "underline" or "background", pointer_color_hover to brand primary or accent. Configure mobile breakpoint with toggle_align "flex-end" and a clear hamburger icon.
   - Right (optional but encouraged): a primary CTA button (e.g. "Book a session" / "Get started") linking to the contact or main conversion page. Use brand accent color.
4. Subtle bottom border or shadow for separation. Mobile: stack to column, hide secondary CTA if cramped.

Match the brand's tone — for refined/luxury brands keep typography elegant and spacing generous; for bold/SaaS brands tighten letter-spacing and increase weight.

The output JSON must have this wrapper:
{
  "content": [ ...elements... ],
  "settings": {},
  "metadata": []
}`;
      break;
    }

    case "footer":
      typeSpecificPrompt = `Generate a FOOTER template with:
- Top-level container: full-width, dark or contrasting background using brand colors via __globals__.
- Inner wrapper to constrain content. Multi-column layout (use container_type: "grid" with grid_columns_grid 3-4) on desktop, stacking on mobile.
- Columns:
  1. Brand mark + short tagline / mission sentence + (optional) social icons.
  2. Navigation links (icon-list or simple stacked link list) — primary pages.
  3. Secondary links — legal, privacy, contact email.
  4. Newsletter signup OR contact details (if blueprint.hasContactForm).
- Bottom strip: copyright text "© <year> ${blueprint.name}. All rights reserved." with brand voice tweak if appropriate.
- Padding generous (60-80px vertical).

The output JSON must have this wrapper:
{
  "content": [ ...elements... ],
  "settings": {},
  "metadata": []
}`;
      break;

    case "single-post": {
      const cptName = template.conditions[0]?.sub_name;
      if (cptName && cptName !== "post") {
        const cpt = blueprint.customPostTypes.find((c) => c.name === cptName);
        typeSpecificPrompt = `Generate a SINGLE ${cpt?.singularLabel || cptName} template (CPT, post-style) with:
- Featured image at top using __dynamic__ post-featured-image tag
- Post title using __dynamic__ post-title tag
- Display ACF custom fields: ${cpt?.fields.map((f) => `${f.label} (${f.key}, field key: ${f.fieldId})`).join(", ")}
- Use __dynamic__ acf-text tags for field values
- Clean readable layout

The output JSON must have this wrapper:
{
  "content": [ ...elements... ],
  "settings": {},
  "metadata": []
}`;
      } else {
        typeSpecificPrompt = `Generate a SINGLE POST (blog) template with:
- Featured image at top (theme-post-featured-image widget with __dynamic__ post-featured-image tag)
- Post title (theme-post-title widget with __dynamic__ post-title tag)
- Author info (author-box widget with layout: "left", alignment: "left")
- Post content (theme-post-content widget — renders the full post body, NO settings needed)
- Share buttons (share-buttons widget with facebook, twitter, linkedin)
- Related posts section using the "posts" widget with posts_post_type: "related"
  CRITICAL: There is NO "related-posts" widget. Use the standard "posts" widget with posts_post_type: "related", posts_exclude: ["current_post"], posts_related_fallback: "fallback_recent"
- Clean, readable blog layout

The output JSON must have this wrapper:
{
  "content": [ ...elements... ],
  "settings": {},
  "metadata": []
}`;
      }
      break;
    }

    case "single-page": {
      // CPT singles use single-page docType so they render through WP's
      // page template chain, not the post chain. No author-box/share-buttons —
      // those are post-specific.
      const cptName = template.conditions[0]?.sub_name;
      const cpt = cptName
        ? blueprint.customPostTypes.find((c) => c.name === cptName)
        : undefined;
      typeSpecificPrompt = `Generate a SINGLE PAGE template${cpt ? ` for the "${cpt.singularLabel}" CPT` : ""}.

This is a single-page template (Theme Builder → Single Page), distinct from blog posts. Do NOT include author-box, share-buttons, or related-posts — those belong to single-post templates only.

Structure:
- Hero section: featured image (theme-post-featured-image, __dynamic__ post-featured-image, object-fit "cover", aspect-ratio enforced via min_height of ~50vh) with the title overlaid OR placed directly below.
- Title block: theme-post-title widget, __dynamic__ post-title, brand heading font, generous spacing.
${cpt && cpt.fields.length > 0
  ? `- ACF detail block: render each custom field using __dynamic__ acf-text tags. Fields available:\n  ${cpt.fields.map((f) => `* ${f.label} → __dynamic__ acf-text with field key "${f.fieldId}"`).join("\n  ")}`
  : "- Body content: theme-post-content widget for the main page body."}
- Optional CTA section at bottom — brand-aligned primary button linking to contact.

The output JSON must have this wrapper:
{
  "content": [ ...elements... ],
  "settings": {},
  "metadata": []
}`;
      break;
    }

    case "archive": {
      const loopItem = findLoopItemForArchive(template, blueprint, templateIdMap);
      const loopItemNote = loopItem
        ? `Use template_id: "${loopItem.id}" (the "${loopItem.title}" template that already generated).`
        : `No matching loop-item template was found in templateIdMap. Set template_id to "" — Elementor will fall back to default rendering.`;

      typeSpecificPrompt = `Generate an ARCHIVE template:

1. Top-level container (isInner: false, content_width: "full") with brand-appropriate background.
2. Inner wrapper container (isInner: true, css_classes: "wrapper").
3. Inside the wrapper:
   - Heading: theme-archive-title widget with __dynamic__ archive-title (NOT a regular heading — the dynamic tag pulls the term/CPT name).
   - Optional taxonomy-filter widget (taxonomy: "category" for blog, or the CPT taxonomy name).
   - loop-grid widget (the ONLY widget that should render the listing — do NOT use the legacy "posts" widget):
     * widgetType: "loop-grid"
     * settings.template_id: STRING (not number). ${loopItemNote}
     * settings.posts_per_page: 9
     * settings.columns: 3
     * settings.columns_tablet: 2
     * settings.columns_mobile: 1
     * settings.pagination_page_limit: "5"
     * settings.pagination_prev_label: "Previous"
     * settings.pagination_next_label: "Next"
     * settings.nothing_found_message_text: "No posts yet — check back soon."
     * settings.enable_nothing_found_message: "yes"
   - Optional CTA section below the grid for newsletter signup or "back to home".

The output JSON must have this wrapper:
{
  "content": [ ...elements... ],
  "settings": {},
  "metadata": []
}`;
      break;
    }

    case "loop-item": {
      const loopCptName = template.title.toLowerCase().includes("post")
        ? "post"
        : blueprint.customPostTypes.find((c) =>
            template.title.toLowerCase().includes(c.singularLabel.toLowerCase())
          )?.name || "post";

      const cpt = blueprint.customPostTypes.find((c) => c.name === loopCptName);
      const acfNote = cpt && cpt.fields.length > 0
        ? `\n- ACF fields available: ${cpt.fields.map((f) => `${f.label} (key: ${f.fieldId})`).join(", ")}. Use __dynamic__ acf-text with the field key to display them — e.g. for a "location" field render the value via __dynamic__ acf-text in a text widget.`
        : "";

      typeSpecificPrompt = `Generate a LOOP ITEM template (one card) for ${cpt?.singularLabel || loopCptName}.

This template renders INSIDE a loop-grid (3-column grid by default). Build a SINGLE card — the parent grid handles layout, so the outer container must NOT have margins or fixed width.

Structure:
1. Top-level container (isInner: false, content_width: "boxed", flex_direction: "column", border_radius ~12-16px, box_shadow_box_shadow soft, overflow: hidden).
2. theme-post-featured-image widget at the top — image_size "medium_large", object-fit "cover", min_height ~220px. Uses __dynamic__ image with name="post-featured-image".
3. Inner container with padding ~24px:
   - Small meta row: post-info widget showing date and category (or a text widget with __dynamic__ post-categories), small body font, muted color.
   - Heading: theme-post-title widget with __dynamic__ post-title, h3, brand heading font, 1.2-1.3 line-height.
   - Excerpt: theme-post-excerpt widget with __dynamic__ excerpt, length ~22, muted text color, 2-3 line-clamp via line-height + max-height if possible.
   - "Read article →" link/button — use a button widget with __dynamic__ link "post-url". Subtle styling (text-style or ghost button) so the card itself feels clickable.${acfNote}

CRITICAL: this template renders inside a loop-grid. Do NOT add margin, max-width, or fixed-width settings on the outer container — let the parent grid lay it out. Also do NOT include navigation, headers, or footers.

The output JSON must have this wrapper:
{
  "content": [ ...elements... ],
  "settings": {},
  "metadata": []
}`;
      break;
    }

    case "error-404":
      typeSpecificPrompt = `Generate a 404 ERROR page template with:
- Centered layout
- Large "404" heading
- "Page Not Found" subheading
- Brief text explaining the page doesn't exist
- "Go Home" button linking to "/"
- Clean, minimal design

The output JSON must have this wrapper:
{
  "content": [ ...elements... ],
  "settings": {},
  "metadata": []
}`;
      break;

    default:
      typeSpecificPrompt = `Generate a template for: ${template.title} (${template.docType})

The output JSON must have this wrapper:
{
  "content": [ ...elements... ],
  "settings": {},
  "metadata": []
}`;
  }

  let errorFeedback = "";
  if (previousError) {
    errorFeedback = `\n\n⚠️ PREVIOUS ATTEMPT FAILED with error: ${previousError}\nPlease fix this issue in your response.`;
  }

  const mediaSection = mediaList ? `\n\n${mediaList}` : "";
  return `${siteContext}\n${colorContext}\n${idList}${mediaSection}\n\n${typeSpecificPrompt}${errorFeedback}`;
}

// ── Element Count Estimator ──────────────────────────────────────

function estimateElementCount(docType: string): number {
  switch (docType) {
    case "header":
      return 12;
    case "footer":
      return 16;
    case "single-post":
      return 20;
    case "single-page":
      return 14;
    case "archive":
      return 10;
    case "loop-item":
      return 8;
    case "error-404":
      return 6;
    default:
      return 10;
  }
}

export async function generateTemplate(
  template: TemplateDef,
  blueprint: SiteBlueprint,
  idMgr: IdManager,
  settingsIds: SiteSettingsIds,
  templateIdMap: Record<string, number>,
  mediaPlan: MediaPlan,
  modelId: ModelId = "claude-opus-4-7"
): Promise<string> {
  const elementCount = estimateElementCount(template.docType);
  const elementIds = idMgr.generateBatch(elementCount + 10);

  return retryWithFeedback(async (attempt, previousError) => {
    const prompt = buildTemplatePrompt(
      template,
      blueprint,
      elementIds,
      settingsIds,
      templateIdMap,
      mediaPlan,
      previousError
    );

    const rawObject = await generateElementJson(modelId, TEMPLATE_SYSTEM_PROMPT, prompt);
    const cleaned = cleanLlmJson(JSON.stringify(rawObject));
    const validation = validateTemplateJson(cleaned);

    if (!validation.valid) {
      console.error("Validation error for template object:", rawObject);
      throw new Error(`Template validation failed: ${validation.error}`);
    }

    return cleaned;
  }, 3);
}
