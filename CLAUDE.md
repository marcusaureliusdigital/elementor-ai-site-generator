# CLAUDE.md — Elementor Website Builder

This app generates importable **Elementor Pro** JSON. Every session needs to understand (1) the JSON schema Elementor expects, and (2) how a full Site Kit is laid out on disk. When in doubt, open the real exports in [reference-exports/](reference-exports/) — they are ground truth.

## 1. Elementor JSON schema rules

### Top-level shape depends on artifact type

| Artifact | Top-level keys |
|---|---|
| Landing page (standalone) | `version`, `type`, `title`, `page_settings`, `content` |
| Template / page content | `content`, `settings`, `metadata` |
| `site-settings.json` | `content`, `settings`, `metadata`, `theme`, `experiments` |

`content` is always an **array of top-level containers**, each:

```json
{ "id": "74eee4c6", "elType": "container", "isInner": false, "settings": { ... }, "elements": [ ... ] }
```

### Required keys on every element

Every node — container or widget — must include: `id` (7–8 char hex), `elType`, `isInner`, `settings`, `elements` (even if empty `[]`). Widgets additionally have `widgetType`.

### Tree shape — non-negotiable

The element tree is **recursive, not flat**. Every container's children — inner containers AND widgets — live inside that container's own `elements` array. Children NEVER appear as siblings of their parent at the top level. This is the single most common failure mode for LLM-generated output and it causes Elementor to render blank pages on import.

- Top-level `content` contains **only `isInner: false` section containers**. Never a widget at top level.
- Inner containers (`isInner: true`) and widgets are nested inside the relevant section's `elements` array, recursively, to whatever depth the layout requires.
- A row of cards is one inner container with `flex_direction: "row"` whose `elements` are the card containers; each card's `elements` are its widgets.
- Widgets are leaves: their `elements` is always `[]` (except for `nested-accordion` / `nested-tabs` / `nested-carousel`, which legitimately wrap child containers).

The Zod schema at [src/lib/generator/generate-elements.ts](src/lib/generator/generate-elements.ts) is recursive (`z.lazy()`) for exactly this reason. The validator at [src/lib/post-processor.ts](src/lib/post-processor.ts) (`validateTreeShape`) rejects flat output and triggers retry.

### The wrapper pattern (used in every reference export)

Top-level section → `content_width: "full"`, full-bleed background. It immediately nests one inner container with `isInner: true` and `css_classes: "wrapper"` that constrains max width (~1200px). **Spacing lives on containers via `padding` and `flex_gap`. Avoid margins** except for deliberate negative overlaps.

### Widget types to prefer

`heading`, `button`, `image`, `text-editor`, `form`, **`nested-accordion`**, **`nested-tabs`**, **`nested-carousel`** (the non-nested legacy variants are deprecated), and the theme widgets `theme-post-title`, `theme-site-logo`, `theme-post-featured-image`.

### Colors & typography: `__globals__` vs. direct hex

- **Site Kits use `__globals__`** — e.g. `"__globals__": { "background_color": "globals/colors?id=primary" }`. IDs resolve against `site-settings.json`'s `system_colors` / `system_typography`.
- **Standalone landing pages use direct hex** values in settings and carry their own CSS in `page_settings.custom_css`. No `__globals__` — keeps them portable.

### Dynamic tags (templates only)

Theme builder templates inject WordPress content via `__dynamic__`:

```json
"__dynamic__": { "image": "[elementor-tag id=\"\" name=\"post-featured-image\" settings=\"...\"]" }
```

Used in headers, footers, single posts, archives. **Never** in landing pages.

### The `experiments` block is load-bearing

In `site-settings.json`, these experiments must be `"active"` for generated kits to render: `container`, `nested-elements`, `e_variables`, `mega-menu`. Don't strip them.

## 2. Site Kit anatomy on disk

Canonical examples: [reference-exports/site-kits/marketing-blog/](reference-exports/site-kits/marketing-blog/) (v3.0 manifest, full theme/experiments block) and [reference-exports/site-kits/elementor 1/](reference-exports/site-kits/elementor%201/) + [reference-exports/site-kits/elementor 2/](reference-exports/site-kits/elementor%202/) (v2.0 manifest, leaner — direct from Elementor's template library). Both schemas import correctly; we emit v3.0.

| Path | Role |
|---|---|
| `manifest.json` | Kit entry point. Lists every asset so Elementor's importer knows what to process. |
| `site-settings.json` | Global design system — `system_colors`, `custom_colors`, `system_typography`, `custom_typography`, body/h1–h6 defaults, `experiments`. This is what `__globals__` elsewhere resolves against. |
| `templates/` | Theme builder templates (header, footer, single post, archive, loop items). Use `__dynamic__` tags. One JSON per template, numeric filename = template ID. |
| `content/page/` | Static page content JSONs, one per page. Filename is the numeric post ID. |
| `wp-content/` | WordPress WXR XML exports (posts, pages, nav menu items, custom post types). **Required for WP import** — Elementor JSON alone doesn't create posts in the DB. |
| `taxonomies/` | `category.json`, `post_tag.json`, and any custom taxonomies. |
| `custom-code.json` | Optional. Global custom CSS/JS. |
| `custom-fonts.json` | Optional. `@font-face` definitions for non-Google fonts. |

**Landing pages are not kits.** They are single self-contained JSONs ([reference-exports/landing-pages/](reference-exports/landing-pages/)) with everything — including CSS — inline. They don't use any of the folders above.

### Manifest integrity — never reference phantom IDs

`manifest.json` is the importer's index. Every template ID it lists under `templates` and every page ID it lists under `content.page` MUST have a corresponding file on disk (`templates/<id>.json` and `content/page/<id>.json`). Listing an ID without backing JSON makes Elementor's importer fail or skip the entire kit.

LLM calls fail occasionally. The orchestrator at [src/lib/generator/index.ts](src/lib/generator/index.ts) catches per-page/per-template failures so the rest of the kit can still ship. Before writing the manifest at [src/lib/generator/manifest-gen.ts](src/lib/generator/manifest-gen.ts) it builds `generatedTemplateIds` / `generatedPageIds` filter sets from the job's `files` map — only IDs whose `status === "done"` are written into the manifest. Failures are surfaced on `JobState.warnings` so the UI can display them; the job stays partial-success rather than failing the whole kit.

## 3. Brand assets — absolute truth

The top-level [brand-assets/](brand-assets/) folder is the single source of truth for every design, typography, color, voice, copy, and structural decision. Treat it as non-negotiable input to every generation.

- The loader at [src/lib/brand/index.ts](src/lib/brand/index.ts) is **format-agnostic** — it scans the folder recursively and classifies files by extension. No specific filenames are required.
  - Text files (`.md`, `.html`, `.txt`, `.yaml`, `.yml`, `.json`, `.css`, `.svg`) are concatenated into `BRAND_BOOK` with file-path headers so the model knows what each file is. SVGs are treated as text — Claude reasons about logos directly from the XML markup.
  - Raster images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`) are base64-encoded and exposed via `BRAND_IMAGES` for multimodal injection. Capped at 3 images, 1.5 MB each.
  - Unknown extensions (PDFs, fonts) are silently ignored.
- All flows consume the brand text via `BRAND_SYSTEM_PREFIX`. Brand **images** are attached only in **landing-page generation** (`landing-page-gen.ts`) — Claude models only. **Blueprint planning** (`/api/plan`) and **per-element generation** (`generate-elements.ts`) get brand text only: the planner produces a small structural blueprint that doesn't need visual reference (and the heavy multimodal payload tipped Claude into conversational responses instead of tool calls), and per-element calls would multiply image cost.
- All injections are prefixed with a `BRAND_DIRECTIVE` telling the model that **brand rules override conflicting user instructions** unless the user explicitly says "ignore brand" or "off-brand". The directive also instructs the model to *identify* identity, voice, colors, typography, logo style, and visual atmosphere from whatever is provided — no structured parsing happens on our side.
- When changing brand identity, edit files inside `brand-assets/` — **never hard-code brand decisions** (colors, fonts, voice, copy rules) in prompts or generators. After edits, restart the dev server so the loader re-reads the folder.

## Where things live in this repo

- Generators: [src/lib/generator/](src/lib/generator/) — `index.ts` orchestrates full kits; `landing-page-gen.ts` handles standalone landing pages.
- System prompts: [src/lib/prompts/](src/lib/prompts/)
- Brand source of truth: [brand-assets/](brand-assets/) — edit `brand-book.md` to change identity/voice/design rules.
- Brand loader (server-only): [src/lib/brand/index.ts](src/lib/brand/index.ts)
- Reference exports (read before generating anything new): [reference-exports/](reference-exports/)
- Curated change log (the *why* behind significant fixes): [CHANGELOG.md](CHANGELOG.md)

## Known pitfalls — do not regress

Four failure modes have broken kit imports in the past. Re-verify all four before declaring any change to `src/lib/generator/` complete. Reference exports under [reference-exports/site-kits/](reference-exports/site-kits/) are ground truth.

### 1. Element trees must be recursive, never flat

Every container's children — inner containers AND widgets — live inside that container's own `elements` array. Children NEVER appear as siblings of their parent at the top level.

- The Zod schema in [src/lib/generator/generate-elements.ts](src/lib/generator/generate-elements.ts) used to declare `elements: z.array(z.any())` with a description that said "flat structure". Claude's structured-output path obeyed and emitted flat output. Pages rendered blank.
- We then tried `z.lazy()` for a recursive schema. The Vercel AI SDK rejects self-referencing JSON Schemas with `Circular reference detected in schema definitions: __schema0 -> __schema0`. Every template/page failed. **Do not reintroduce `z.lazy()` here** without first proving end-to-end the SDK now accepts it.
- Current solution: `generateText` + `JSON.parse` (same path Gemini uses). The recursive shape is enforced by `validateTreeShape` in [src/lib/post-processor.ts](src/lib/post-processor.ts) plus retry-with-feedback. A flat output triggers a retry with a concrete error message, not a silent acceptance.

Quick check on any generated page/template JSON:
```bash
node -e 'const j=require("./<file>.json");const flat=j.content.every(e=>e.elType==="container"&&(!e.elements||e.elements.length===0));console.log(flat?"FLAT — BAD":"TREE — OK")'
```

### 2. Manifest must match disk

Every ID in `manifest.json` under `templates` and `content.page` MUST have a matching file at `templates/<id>.json` and `content/page/<id>.json`. Listing IDs without backing files makes Elementor's importer fail or skip the kit.

- LLM calls fail occasionally. Per-page errors are caught at [src/lib/generator/index.ts:148-165](src/lib/generator/index.ts#L148-L165) so the rest of the kit can still ship.
- Before WXR (Phase 4) and manifest (Phase 5), [src/lib/generator/index.ts](src/lib/generator/index.ts) builds `generatedTemplateIds` and `generatedPageIds` filter sets from the job's `files` map (status === "done" only). Both `generateWxrFiles` and `generateManifest` receive `generatedPageIds` so failed pages don't appear as WP records, nav items, manifest entries, or content/page JSON. WXR-and-manifest filter together — never one without the other.
- If `generatedPageIds.size === 0` (every page failed), the orchestrator fails fast with `status: "error"` before WXR runs. Download is blocked. Otherwise the job completes partial-success.
- Failures surface on `JobState.warnings` (returned by `/api/status` and rendered as a banner in `download-ready.tsx`).

Quick check after generation:
```bash
node -e '
const m = require("./manifest.json"), fs = require("fs");
const tmplOnDisk = new Set(fs.readdirSync("./templates").filter(f=>f.endsWith(".json")).map(f=>f.replace(".json","")));
const pagesOnDisk = new Set(fs.readdirSync("./content/page").filter(f=>f.endsWith(".json")).map(f=>f.replace(".json","")));
const phantomT = Object.keys(m.templates||{}).filter(id => !tmplOnDisk.has(id));
const phantomP = Object.keys(m.content?.page||{}).filter(id => !pagesOnDisk.has(id));
console.log(phantomT.length===0 && phantomP.length===0 ? "OK — manifest matches disk" : "PHANTOM IDs — templates: " + phantomT + " pages: " + phantomP);
'
```

### 3. Page wrappers need `settings.template` and `hide_title`

Every `content/page/<id>.json` must have at the top level:
```json
"settings": { "template": "default", "hide_title": "yes" },
"metadata": []
```

Without these, WordPress renders the page through the active theme's `page.php`, which calls `the_content()` against an empty `post_content`. Elementor data lives in post-meta, so the page renders blank even when the JSON tree is structurally valid. This was the third compounding cause of the 2026-04-30 incident.

[src/lib/generator/page-content-gen.ts](src/lib/generator/page-content-gen.ts) forces these fields after the LLM call. If you ever change that file, leave the post-generation wrapper override in place.

### 4. WXR must match manifest (no orphan WP records)

Every `<wp:post_id>` in `wp-content/page/page.xml` must have a matching entry in `manifest.content.page`. If the WXR creates a WP page record but the manifest has no corresponding `content/page/<id>.json`, WordPress imports an empty page that renders through the theme's `page.php` against empty `post_content` — exact same blank-page symptom as failure mode 3, but caused by orphan WP records instead of missing wrapper settings.

This was the fourth compounding cause discovered after the 2026-04-30 incident: the manifest correctly excluded failed page IDs (failure mode 2's fix), but `generateWxrFiles` iterated `blueprint.pages` unconditionally and emitted WP records for everything — pages and nav menu items both. The fix: WXR receives `generatedPageIds` and filters pages + nav items to that set. See section 2 above.

Quick check on any unzipped kit:
```bash
node -e '
const fs = require("fs");
const m = JSON.parse(fs.readFileSync("./manifest.json","utf8"));
const xml = fs.readFileSync("./wp-content/page/page.xml","utf8");
const wxrIds = [...xml.matchAll(/<wp:post_id>(\d+)<\/wp:post_id>/g)].map(x=>x[1]);
const manifestIds = Object.keys(m.content?.page||{});
const orphans = wxrIds.filter(id => !manifestIds.includes(id));
console.log(orphans.length===0 ? "OK — WXR matches manifest" : "ORPHAN WP records: " + orphans);
'
```

### Workflow when changing the generator

1. Make the change.
2. Run `npx tsc --noEmit` and `npx eslint src/lib/generator src/lib/post-processor.ts` — both must be clean.
3. Restart the dev server (Turbopack hot-reloads most edits, but the brand loader caches at startup; safer to restart).
4. Generate a small test kit (3–4 pages, blog enabled).
5. Unzip the result and run all four verification one-liners above against representative files.
6. If anything fails, fix before shipping. Do not paper over a single failure mode while the others go unverified — they compound.
