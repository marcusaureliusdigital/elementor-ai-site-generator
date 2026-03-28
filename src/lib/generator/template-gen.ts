import type { ModelId } from "../ai-provider";
import { TEMPLATE_SYSTEM_PROMPT } from "../prompts/template-system";
import { IdManager } from "../id-manager";
import { validateTemplateJson } from "../post-processor";
import { retryWithFeedback } from "./retry";
import { generateElementJson } from "./generate-elements";
import type { SiteBlueprint, TemplateDef } from "../types";
import type { SiteSettingsIds } from "./site-settings-gen";

// ── Prompt Builders ──────────────────────────────────────────────

function buildTemplatePrompt(
  template: TemplateDef,
  blueprint: SiteBlueprint,
  elementIds: string[],
  settingsIds: SiteSettingsIds,
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

  let typeSpecificPrompt = "";

  switch (template.docType) {
    case "header":
      typeSpecificPrompt = `Generate a HEADER template with:
- A full-width container with row direction
- Site logo on the left (theme-site-logo widget with __dynamic__ site-logo tag)
- Navigation menu on the right (nav-menu widget, menu: "main-menu")
- Clean, professional styling matching the site's color scheme
- Responsive: stack to column on mobile

The output JSON must have this wrapper:
{
  "content": [ ...elements... ],
  "settings": {},
  "metadata": []
}`;
      break;

    case "footer":
      typeSpecificPrompt = `Generate a FOOTER template with:
- Dark or contrasting background
- Site name or logo text
- Copyright text with current year
- Social media links if applicable
- Simple, clean layout

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
        typeSpecificPrompt = `Generate a SINGLE ${cpt?.singularLabel || cptName} template with:
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

    case "archive":
      typeSpecificPrompt = `Generate an ARCHIVE template with:
- Archive title heading using __dynamic__ archive-title tag on a heading widget
- Posts grid using the "posts" widget (skin: "classic" or "cards") with pagination_type: "numbers" or "load_more_on_click"
- Alternatively, use "loop-grid" widget with a template_id reference for custom card layouts
- Optional newsletter/subscribe form section
- Clean grid layout with responsive columns

The output JSON must have this wrapper:
{
  "content": [ ...elements... ],
  "settings": {},
  "metadata": []
}`;
      break;

    case "loop-item": {
      const loopCptName = template.title.toLowerCase().includes("post")
        ? "post"
        : blueprint.customPostTypes.find((c) =>
            template.title.toLowerCase().includes(c.singularLabel.toLowerCase())
          )?.name || "post";

      typeSpecificPrompt = `Generate a LOOP ITEM template (card) for ${loopCptName} with:
- Container with featured image as background using __dynamic__ post-featured-image
- Post title using __dynamic__ post-title tag
- Post excerpt or summary text
- Link to post using __dynamic__ post-url tag on a button or the container link
- Card-like styling with border radius, shadow, and hover effect

IMPORTANT: This is a loop item used in carousels/grids, so it should be a SINGLE card, not a grid.

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

  return `${siteContext}\n${colorContext}\n${idList}\n\n${typeSpecificPrompt}${errorFeedback}`;
}

// ── Element Count Estimator ──────────────────────────────────────

function estimateElementCount(docType: string): number {
  switch (docType) {
    case "header":
      return 8;
    case "footer":
      return 10;
    case "single-post":
      return 20;
    case "archive":
      return 8;
    case "loop-item":
      return 6;
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
  modelId: ModelId = "claude-opus-4-6"
): Promise<string> {
  const elementCount = estimateElementCount(template.docType);
  const elementIds = idMgr.generateBatch(elementCount + 10);

  return retryWithFeedback(async (attempt, previousError) => {
    const prompt = buildTemplatePrompt(
      template,
      blueprint,
      elementIds,
      settingsIds,
      previousError
    );

    const rawObject = await generateElementJson(modelId, TEMPLATE_SYSTEM_PROMPT, prompt);
    const cleaned = JSON.stringify(rawObject);
    const validation = validateTemplateJson(cleaned);

    if (!validation.valid) {
      console.error("Validation error for template object:", rawObject);
      throw new Error(`Template validation failed: ${validation.error}`);
    }

    return cleaned;
  }, 3);
}
