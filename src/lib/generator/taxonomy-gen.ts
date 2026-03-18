import type { SiteBlueprint, CategoryDef } from "../types";
import { IdManager } from "../id-manager";

/**
 * Generates taxonomy JSON files from a blueprint.
 *
 * Returns a map of taxonomy_name → JSON string.
 * Always generates nav_menu.json. Optionally generates category.json and CPT taxonomies.
 */

export function generateTaxonomies(
  blueprint: SiteBlueprint,
  idMgr: IdManager
): Record<string, string> {
  const result: Record<string, string> = {};

  // Nav menu (always present)
  const navMenuTermId = idMgr.allocateTermId();
  result.nav_menu = JSON.stringify([
    {
      term_id: navMenuTermId,
      name: "Main Menu",
      slug: "main-menu",
      taxonomy: "nav_menu",
      description: "",
      parent: 0,
    },
  ]);

  // Group categories by taxonomy
  const byTaxonomy = new Map<string, CategoryDef[]>();
  for (const cat of blueprint.categories) {
    const existing = byTaxonomy.get(cat.taxonomy) || [];
    existing.push(cat);
    byTaxonomy.set(cat.taxonomy, existing);
  }

  // Generate JSON for each taxonomy
  for (const [taxonomy, cats] of byTaxonomy) {
    result[taxonomy] = JSON.stringify(
      cats.map((c) => ({
        term_id: c.termId,
        name: c.name,
        slug: c.slug,
        taxonomy: c.taxonomy,
        description: "",
        parent: c.parent,
      }))
    );
  }

  return result;
}
