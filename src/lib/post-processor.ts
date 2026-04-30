/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Post-processing utilities for LLM-generated Elementor JSON.
 *
 * Validates structure, verifies IDs, and fixes common LLM mistakes.
 */

interface ElementorElement {
  id: string;
  elType: string;
  isInner?: boolean;
  settings: Record<string, unknown>;
  elements: ElementorElement[];
  widgetType?: string;
}

interface TemplateJson {
  content: ElementorElement[];
  settings: Record<string, unknown> | unknown[];
  metadata: unknown[];
}

/**
 * Validates that a string is valid JSON and has the expected Elementor structure.
 */
export function validateTemplateJson(jsonStr: string): {
  valid: boolean;
  error?: string;
  parsed?: TemplateJson;
} {
  let parsed: TemplateJson;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return { valid: false, error: `Invalid JSON: ${(e as Error).message}` };
  }

  if (!parsed.content || !Array.isArray(parsed.content)) {
    return { valid: false, error: "Missing or invalid 'content' array" };
  }

  if (parsed.content.length === 0) {
    return { valid: false, error: "Empty content array" };
  }

  // Tree-shape sanity check — catches the "flat sibling list" failure mode
  // where the LLM emits every element at top level with empty `elements: []`.
  const shapeError = validateTreeShape(parsed.content);
  if (shapeError) {
    return { valid: false, error: shapeError };
  }

  // Validate each element recursively
  const elementErrors = validateElements(parsed.content);
  if (elementErrors.length > 0) {
    return { valid: false, error: elementErrors.join("; ") };
  }

  return { valid: true, parsed };
}

/**
 * Detects flat-sibling output (children emitted as siblings of their parent
 * container instead of nested inside it). Real Elementor exports always have
 * containers at top level — never widgets — and at least one of them carries
 * children. Either signal alone is enough to reject and trigger retry.
 */
function validateTreeShape(content: ElementorElement[]): string | null {
  const flatMessage =
    "Element tree is flat. Re-emit as a TREE: every container's children must live INSIDE that container's own `elements` array, not as siblings at the top level. Top-level `content` must contain only containers, and inner containers/widgets must be nested recursively inside their parent container's `elements` array.";

  const topLevelWidget = content.find((el) => el.elType === "widget");
  if (topLevelWidget) {
    return `${flatMessage} (Found widget "${topLevelWidget.widgetType ?? topLevelWidget.id}" at top level.)`;
  }

  if (content.length >= 2) {
    const allEmpty = content.every(
      (el) => el.elType === "container" && (!Array.isArray(el.elements) || el.elements.length === 0)
    );
    if (allEmpty) {
      return flatMessage;
    }
  }

  return null;
}

/** All valid Elementor widget types — sourced from real Elementor Pro templates */
const VALID_WIDGET_TYPES = new Set([
  // Basic
  "heading", "text-editor", "button", "image", "icon", "icon-box", "icon-list",
  "counter", "divider", "rating", "html", "menu-anchor", "search", "search-form",
  // Pro
  "form", "posts", "testimonial", "testimonial-carousel", "image-carousel",
  "nested-accordion", "nested-tabs", "nested-carousel",
  "loop-grid", "loop-carousel", "nav-menu", "mega-menu", "off-canvas",
  "table-of-contents", "progress-tracker", "animated-headline", "breadcrumbs",
  // Theme Builder
  "theme-post-title", "theme-post-content", "theme-post-excerpt",
  "theme-post-featured-image", "theme-archive-title",
  "theme-site-logo", "theme-site-title",
  "author-box", "post-info", "post-navigation", "share-buttons",
  "archive-posts", "taxonomy-filter",
  // i18n
  "wpml-language-switcher",
  // Legacy
  "accordion",
]);

/** Common LLM hallucinations → correct widget type */
const WIDGET_TYPE_FIXES: Record<string, string> = {
  "related-posts": "posts",
  "Related-posts": "posts",
  "related_posts": "posts",
  "blog-posts": "posts",
  "post-grid": "posts",
  "post-carousel": "loop-carousel",
  "post-list": "posts",
  "site-logo": "theme-site-logo",
  "site-title": "theme-site-title",
  "post-title": "theme-post-title",
  "post-content": "theme-post-content",
  "post-excerpt": "theme-post-excerpt",
  "post-featured-image": "theme-post-featured-image",
  "featured-image": "theme-post-featured-image",
  "archive-title": "theme-archive-title",
  "social-share": "share-buttons",
  "social-icons": "share-buttons",
  "toc": "table-of-contents",
  "tabs": "nested-tabs",
  "carousel": "nested-carousel",
};

/** Nested widgets that legitimately have child containers */
const NESTED_WIDGET_TYPES = new Set([
  "nested-accordion",
  "nested-tabs",
  "nested-carousel",
]);

function validateElements(elements: ElementorElement[], depth = 0): string[] {
  const errors: string[] = [];

  for (const el of elements) {
    if (!el.id || typeof el.id !== "string") {
      errors.push(`Element missing id at depth ${depth}`);
    } else if (!/^[0-9a-f]{7,8}$/.test(el.id)) {
      errors.push(`Invalid element ID format: "${el.id}" (expected 7-8 char hex)`);
    }

    if (!el.elType || !["container", "widget"].includes(el.elType)) {
      errors.push(`Invalid elType: "${el.elType}" for element ${el.id}`);
    }

    if (!el.settings || typeof el.settings !== "object") {
      errors.push(`Missing settings for element ${el.id}`);
    }

    if (!Array.isArray(el.elements)) {
      errors.push(`Missing elements array for element ${el.id}`);
    }

    // Validate widget type is known
    if (el.elType === "widget" && el.widgetType) {
      if (!VALID_WIDGET_TYPES.has(el.widgetType)) {
        errors.push(`Unknown widget type "${el.widgetType}" on element ${el.id}`);
      }
    }

    // Widgets must not have children — EXCEPT nested widgets which require child containers
    if (
      el.elType === "widget" &&
      el.elements &&
      el.elements.length > 0 &&
      !NESTED_WIDGET_TYPES.has(el.widgetType || "")
    ) {
      errors.push(`Widget ${el.id} has children (widgets must have empty elements)`);
    }

    // Recursively validate children
    if (el.elements && el.elements.length > 0) {
      errors.push(...validateElements(el.elements, depth + 1));
    }
  }

  return errors;
}

/**
 * Extracts all element IDs from an Elementor element tree.
 */
export function extractElementIds(elements: ElementorElement[]): string[] {
  const ids: string[] = [];
  for (const el of elements) {
    if (el.id) ids.push(el.id);
    if (el.elements) ids.push(...extractElementIds(el.elements));
  }
  return ids;
}

/**
 * Validates that element IDs match the expected allocated set.
 */
export function validateElementIds(
  expectedIds: string[],
  actualIds: string[]
): { valid: boolean; missing: string[]; extra: string[] } {
  const expectedSet = new Set(expectedIds);
  const actualSet = new Set(actualIds);
  const missing = expectedIds.filter((id) => !actualSet.has(id));
  const extra = actualIds.filter((id) => !expectedSet.has(id));
  return {
    valid: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  };
}

/**
 * Replaces placeholder image URLs with consistent placehold.co URLs.
 */
export function normalizeImageUrls(jsonStr: string): string {
  // Replace various placeholder patterns with placehold.co
  return jsonStr
    .replace(
      /https?:\/\/(?:via\.placeholder\.com|placeholder\.com|dummyimage\.com)\/(\d+)x?(\d+)?/g,
      (_, w, h) => `https://placehold.co/${w}x${h || w}`
    );
}

/**
 * Auto-fixes hallucinated widget types to their correct Elementor equivalents.
 * Must run BEFORE validation so the corrected types pass the whitelist check.
 */
function fixWidgetTypes(elements: ElementorElement[]): void {
  for (const el of elements) {
    if (el.elType === "widget" && el.widgetType) {
      const fix = WIDGET_TYPE_FIXES[el.widgetType];
      if (fix) {
        const original = el.widgetType;
        el.widgetType = fix;

        // If fixing "related-posts" → "posts", inject related query settings
        if (original.toLowerCase().includes("related") && fix === "posts") {
          const s = el.settings as Record<string, any>;
          if (!s.posts_post_type) s.posts_post_type = "related";
          if (!s.posts_exclude) s.posts_exclude = ["current_post"];
          if (!s.posts_related_fallback) s.posts_related_fallback = "fallback_recent";
        }
      }
    }
    if (el.elements && el.elements.length > 0) {
      fixWidgetTypes(el.elements);
    }
  }
}

/**
 * Recursively walks an element tree and applies normalization fixups:
 * - Adds "sizes": [] to { unit, size } dimension objects
 * - Adds background_background: "classic" on containers with background_color
 * - Adds typography_typography: "custom" when font attributes are present
 * - Normalizes flex_gap to include isLinked, unit, size
 */
function normalizeElementSettings(elements: ElementorElement[]): void {
  for (const el of elements) {
    if (!el.settings || typeof el.settings !== "object") continue;
    const s = el.settings as Record<string, any>;

    // Container background activation
    if (el.elType === "container" && s.background_color && !s.background_background) {
      s.background_background = "classic";
    }

    // Typography activation — check for any *_font_family or *_font_size without *_typography
    for (const key of Object.keys(s)) {
      if (key.endsWith("_font_family") || key.endsWith("_font_size") || key.endsWith("_font_weight")) {
        const parts = key.split("_font_");
        if (parts.length === 2) {
          const activationKey = parts[0] + "_typography";
          if (activationKey.endsWith("_typography") && !s[activationKey]) {
            s[activationKey] = "custom";
          }
        }
      }
    }

    // flex_gap normalization
    if (s.flex_gap && typeof s.flex_gap === "object" && s.flex_gap.column !== undefined) {
      if (s.flex_gap.isLinked === undefined) s.flex_gap.isLinked = true;
      if (s.flex_gap.unit === undefined) s.flex_gap.unit = "px";
      if (s.flex_gap.size === undefined) s.flex_gap.size = parseInt(s.flex_gap.column) || 0;
    }

    // Add sizes: [] to dimension objects ({ unit, size } without top/right/bottom/left)
    for (const val of Object.values(s)) {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        const obj = val as Record<string, any>;
        if ("unit" in obj && "size" in obj && !("top" in obj) && !("sizes" in obj)) {
          obj.sizes = [];
        }
      }
    }

    // Recurse
    if (el.elements && el.elements.length > 0) {
      normalizeElementSettings(el.elements);
    }
  }
}

/**
 * Attempts to fix common JSON issues from LLM output.
 */
export function cleanLlmJson(raw: string): string {
  let cleaned = raw.trim();

  // Remove markdown code fences
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  cleaned = cleaned.trim();

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");

  // Normalize image URLs
  cleaned = normalizeImageUrls(cleaned);

  // Normalize element settings and fix old wrapper format
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.content && Array.isArray(parsed.content)) {
      let changed = false;

      // Auto-fix hallucinated widget types before validation
      fixWidgetTypes(parsed.content);
      // Normalize element tree: fix backgrounds, typography, flex_gap, sizes
      normalizeElementSettings(parsed.content);
      changed = true;

      // Convert old format to new
      if ("page_settings" in parsed && !("settings" in parsed)) {
        parsed.settings = parsed.page_settings || [];
        delete parsed.page_settings;
        changed = true;
      }
      if (!("metadata" in parsed)) {
        parsed.metadata = [];
        changed = true;
      }
      // Remove old keys that real templates don't have
      if ("version" in parsed) {
        delete parsed.version;
        changed = true;
      }
      if ("title" in parsed) {
        delete parsed.title;
        changed = true;
      }
      if ("type" in parsed) {
        delete parsed.type;
        changed = true;
      }

      if (changed) {
        cleaned = JSON.stringify(parsed);
      }
    }
  } catch {
    // JSON parse failed — will be caught by validation later
  }

  return cleaned;
}
