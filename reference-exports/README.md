# Reference Exports

Real Elementor Pro exports used as ground-truth references for the generator in `src/lib/generator/` and the system prompts in `src/lib/prompts/`. These files are **documentation only** — nothing in `src/` imports from here. When the generator's output format drifts, this is the authoritative source for what valid Elementor JSON actually looks like.

- `landing-pages/` — Self-contained single-file landing page exports (direct hex colors, inline `custom_css`, no `__globals__`).
- `theme-parts/` — Header, footer, archive, and single-post template exports. Demonstrate `__dynamic__` tags for WordPress content.
- `site-kits/` — Full multi-page site kits as they appear on disk after a WordPress export: `manifest.json`, `site-settings.json`, `templates/`, `content/page/`, `wp-content/` (WXR), `taxonomies/`.

See `CLAUDE.md` at the repo root for the schema rules and Site Kit anatomy these exports illustrate.
