import type { SiteBlueprint } from "../types";
import { ELEMENTOR_EXPERIMENTS } from "../constants";

/**
 * Generates manifest.json from a completed blueprint.
 *
 * The manifest is the master cross-reference for the entire site kit.
 * It's generated LAST because it needs all IDs from templates, pages, and wp-content.
 *
 * Format matched exactly to real Elementor Pro export (Example website/manifest.json).
 */

export interface ManifestContext {
  /** Nav menu item IDs allocated during WXR generation, keyed by page title */
  navMenuItemIds: Record<string, number>;
  /** All WXR content items by post type: { page: [{id, title}], post: [...], ... } */
  wpContentItems: Record<string, { id: number; title: string }[]>;
}

export function generateManifest(
  blueprint: SiteBlueprint,
  context: ManifestContext
): string {
  const {
    slug,
    title,
    description,
    siteUrl,
    author,
    templates,
    pages,
    customPostTypes,
    categories,
    plugins,
  } = blueprint;

  // ── Templates map ─────────────────────────────────────────────

  const templatesMap: Record<
    string,
    {
      title: string;
      doc_type: string;
      thumbnail: false;
      location?: string;
      conditions?: Array<{
        type: string;
        name: string;
        sub_name: string;
        sub_id: string;
      }>;
    }
  > = {};

  for (const tpl of templates) {
    const entry: (typeof templatesMap)[string] = {
      title: tpl.title,
      doc_type: tpl.docType,
      thumbnail: false,
    };

    if (tpl.location) {
      entry.location = tpl.location;
    }

    if (tpl.conditions && tpl.conditions.length > 0) {
      entry.conditions = tpl.conditions;
    }

    templatesMap[String(tpl.id)] = entry;
  }

  // ── Taxonomies map (keyed by post type, value is array of taxonomy defs) ──

  const taxonomiesMap: Record<
    string,
    Array<{ name: string; label: string }>
  > = {};

  // Nav menu taxonomy always present, keyed to nav_menu_item post type
  taxonomiesMap["nav_menu_item"] = [
    { name: "nav_menu", label: "Navigation Menus" },
  ];

  // Blog categories
  const blogCats = categories.filter((c) => c.taxonomy === "category");
  if (blogCats.length > 0) {
    taxonomiesMap["post"] = [{ name: "category", label: "Categories" }];
  }

  // CPT taxonomies
  for (const cpt of customPostTypes) {
    const cptCats = categories.filter((c) => c.taxonomy === cpt.name);
    if (cptCats.length > 0) {
      if (!taxonomiesMap[cpt.name]) {
        taxonomiesMap[cpt.name] = [];
      }
      taxonomiesMap[cpt.name].push({
        name: cpt.name,
        label: cpt.label,
      });
    }
  }

  // ── Content pages map ─────────────────────────────────────────

  const contentPages: Record<
    string,
    {
      title: string;
      excerpt: string;
      doc_type: string;
      thumbnail: false;
      url: string;
      terms: never[];
      show_on_front?: boolean;
    }
  > = {};

  for (const page of pages) {
    contentPages[String(page.id)] = {
      title: page.title,
      excerpt: "",
      doc_type: "wp-page",
      thumbnail: false,
      url: page.isHome ? `${siteUrl}/` : `${siteUrl}/${page.slug}/`,
      terms: [],
      ...(page.isHome && { show_on_front: true }),
    };
  }

  // ── WP-Content map (actual content items with IDs) ────────────

  const wpContent: Record<string, Record<string, { id: number; title: string }>> = {};

  for (const [postType, items] of Object.entries(context.wpContentItems)) {
    wpContent[postType] = {};
    for (const item of items) {
      wpContent[postType][String(item.id)] = {
        id: item.id,
        title: item.title,
      };
    }
  }

  // ── Custom post type title map ────────────────────────────────

  const cptTitles: Record<string, { name: string; label: string }> = {};
  for (const cpt of customPostTypes) {
    cptTitles[cpt.name] = {
      name: cpt.name,
      label: cpt.label,
    };
  }

  // ── Site settings (boolean flags matching real format) ─────────

  const siteSettingsFlags = {
    theme: true,
    globalColors: true,
    globalFonts: true,
    themeStyleSettings: true,
    generalSettings: true,
    experiments: true,
    customCode: true,
    customIcons: true,
    customFonts: true,
  };

  // ── Experiments list (full list from real Elementor Pro export) ──

  const experiments = [...ELEMENTOR_EXPERIMENTS];

  // ── Assemble manifest ─────────────────────────────────────────

  const manifest: Record<string, unknown> = {
    name: slug,
    title,
    description,
    author: author.name,
    version: "3.0",
    elementor_version: "3.35.7",
    created: new Date().toISOString().replace("T", " ").substring(0, 19),
    thumbnail: false,
    site: siteUrl,
    theme: {
      name: "Hello Elementor",
      theme_uri:
        "https://elementor.com/hello-theme/?utm_source=wp-themes&utm_campaign=theme-uri&utm_medium=wp-dash",
      version: "3.4.6",
      slug: "hello-elementor",
    },
    experiments,
    "site-settings": siteSettingsFlags,
    plugins: plugins.map((p) => ({
      name: p.name,
      plugin: p.plugin,
      pluginUri: p.pluginUri || "",
      version: p.version || "",
    })),
    templates: templatesMap,
    taxonomies: taxonomiesMap,
    content: {
      page: contentPages,
      post: [],
      "e-floating-buttons": [],
      "elementor_component": [],
    },
    "wp-content": wpContent,
  };

  // CPT titles — always present (empty object if no CPTs)
  manifest["custom-post-type-title"] = Object.keys(cptTitles).length > 0 ? cptTitles : {};

  // Custom fonts and custom code as empty objects for MVP
  manifest["custom-fonts"] = {};
  manifest["custom-code"] = {};

  return JSON.stringify(manifest, null, 2);
}
