/**
 * Returns empty custom fonts for MVP.
 * Google Fonts are loaded automatically by Elementor when referenced
 * in site-settings typography, so no custom-fonts.json entries needed.
 *
 * This would be used for self-hosted fonts (woff2 files uploaded to WP).
 */
export function generateCustomFonts(): string {
  return JSON.stringify([]);
}
