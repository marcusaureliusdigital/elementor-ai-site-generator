import JSZip from "jszip";
import type { SiteKitFiles } from "./types";

/**
 * Assembles a complete Elementor Pro Site Kit .zip from generated files.
 *
 * Folder hierarchy (must match exactly):
 * /
 * ├── manifest.json
 * ├── site-settings.json
 * ├── custom-code.json
 * ├── custom-fonts.json
 * ├── templates/
 * │   └── [id].json
 * ├── taxonomies/
 * │   ├── category.json
 * │   └── nav_menu.json
 * ├── content/
 * │   └── page/
 * │       └── [id].json
 * └── wp-content/
 *     ├── page/page.xml
 *     ├── post/post.xml
 *     ├── nav_menu_item/nav_menu_item.xml
 *     └── [cpt]/[cpt].xml
 */
export async function bundleSiteKit(files: SiteKitFiles): Promise<Uint8Array> {
  const zip = new JSZip();

  // Root-level files
  zip.file("manifest.json", files.manifest);
  zip.file("site-settings.json", files.siteSettings);
  zip.file("custom-code.json", files.customCode);
  zip.file("custom-fonts.json", files.customFonts);

  // Templates — keyed by ID, e.g. { "145": "..." }
  for (const [id, content] of Object.entries(files.templates)) {
    zip.file(`templates/${id}.json`, content);
  }

  // Taxonomies — keyed by taxonomy name, e.g. { "category": "...", "nav_menu": "..." }
  for (const [name, content] of Object.entries(files.taxonomies)) {
    zip.file(`taxonomies/${name}.json`, content);
  }

  // Content pages — keyed by ID, e.g. { "14": "..." }
  for (const [id, content] of Object.entries(files.contentPages)) {
    zip.file(`content/page/${id}.json`, content);
  }

  // WP content — keyed by path, e.g. { "page/page": "...", "destination/destination": "..." }
  for (const [path, content] of Object.entries(files.wpContent)) {
    zip.file(`wp-content/${path}.xml`, content);
  }

  const buffer = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return buffer;
}
