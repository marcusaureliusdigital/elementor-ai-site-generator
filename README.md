# Elementor AI Site Generator

An AI-powered tool that generates complete, importable Elementor Pro site kits and landing pages from a text prompt. Built with Next.js, the Vercel AI SDK, and support for both Claude and Gemini models.

Describe what you want — the app creates a blueprint, lets you review it, then generates production-ready Elementor JSON you can import directly into WordPress.

Important note: This project was built for fun and is still under active development. It is not intended for production use and should not be deployed on live or client websites. You are solely responsible for reviewing, testing, and validating any output before use. Always use a staging environment and maintain full backups.

---

## Features

- **Two generation modes** — full multi-page website (site kit with header, footer, templates, pages) or single landing page
- **Dual AI model support** — Claude Opus 4.6 (Anthropic) and Gemini 3.1 Pro (Google), selectable per generation
- **Blueprint review** — AI proposes a site plan (pages, colors, typography, sections) that you can edit before generation starts
- **Brand asset injection** — your brand identity (colors, fonts, voice, logo, background texture) is automatically included in every AI prompt
- **Elementor Pro compatible** — output matches real Elementor export format with containers, flexbox, nested widgets (nested-accordion, nested-tabs, nested-carousel), and page-level custom CSS
- **Live progress tracking** — section-by-section progress during generation
- **One-click download** — landing pages as `.json`, full sites as `.zip` site kit

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/elementor-website-builder.git
cd elementor-website-builder
npm install
```

### 2. Configure API keys

```bash
cp .env.example .env.local
```

Open `.env.local` and add your API key(s). You need at least one:

```
ANTHROPIC_API_KEY=sk-ant-...        # For Claude — https://console.anthropic.com/
GOOGLE_GENERATIVE_AI_API_KEY=AIza... # For Gemini — https://aistudio.google.com/apikey
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start generating.

---

## How It Works

```
Prompt --> Blueprint (AI) --> Review & Edit --> Generate (AI) --> Download
```

1. **Prompt** — you describe the website or landing page you want
2. **Blueprint** — the AI creates a structured plan: site name, pages, sections, colors, fonts, content strategy
3. **Review** — you see the blueprint and can edit colors, fonts, sections, pages before committing
4. **Generate** — the AI builds Elementor-compatible JSON for every template and page, section by section
5. **Download** — get a `.json` file (landing page) or `.zip` site kit (full website) ready to import into WordPress via Elementor

### Landing Page Mode
Single-file output with the structure Elementor expects:
```json
{
  "version": "0.4",
  "type": "page",
  "title": "Your Landing Page",
  "page_settings": { "hide_title": "yes", "custom_css": "..." },
  "content": [ "...sections..." ]
}
```

### Full Website Mode
ZIP archive containing a complete Elementor Site Kit:
- `manifest.json` — site kit metadata
- `site-settings.json` — global colors, typography, theme settings
- `templates/` — header, footer, single post, archive, 404
- `content/` — individual page JSON files
- `wp-content.xml` — WordPress WXR import file

---

## Brand Customization

The app ships with example brand assets in `src/lib/brand/`. These are injected into every AI prompt so the generated output matches your brand. Replace them with your own:

### Files to Replace

| File | Format | What It Does |
|------|--------|-------------|
| `src/lib/brand/marcus-aurelius-brand.md` | Markdown | Complete brand identity — colors, typography, visual style, logo rules, voice summary. This is the primary brand reference the AI uses. |
| `src/lib/brand/brand-voice.yaml` | YAML | Detailed voice/tone profile — formality, warmth, directness scores, vocabulary preferences, banned words, opening/closing patterns. |
| `src/lib/brand/frontend-design.md` | Markdown | Frontend design guidelines — aesthetic direction, typography philosophy, color strategy, motion/animation preferences. |
| `src/lib/brand/background-texture.png` | PNG | Brand background texture — sent as a visual reference to Claude so it can replicate the aesthetic in generated CSS. |
| `src/lib/brand/logo-white-noise.png` | PNG | Brand logo — sent as visual reference to Claude for brand context. |

### How to Create Your Own

**`marcus-aurelius-brand.md`** — the most important file. Include:
- Brand name, founder, tagline, positioning
- Color palette with hex codes and usage rules (which color for backgrounds, text, accents, CTAs)
- Typography with specific Google Fonts (heading font, body font, weights)
- Visual style direction (minimal, maximalist, dark-mode, light-mode, etc.)
- Voice quick reference (personality, tone, do/don't)

**`brand-voice.yaml`** — structured voice profile:
```yaml
voiceSummary: >
  A brief description of how your brand communicates.
coreTraits:
  formality:
    score: 38  # 0=very informal, 100=very formal
  directness:
    score: 80
  brevity:
    score: 72
lexicon:
  signatureWords: [scale, system, traction]
  bannedVocab: [leverage, delve, synergy]
```

**`frontend-design.md`** — design philosophy:
- Aesthetic direction (brutalist, minimal, luxury, playful, etc.)
- Typography preferences (distinctive display fonts, body fonts)
- Color strategy (dominant colors, accent usage)
- Motion/animation preferences
- What to avoid

**PNG assets** — any two images that represent your brand's visual identity. These are only sent to Claude (not Gemini) as visual context. They can be your logo, a brand texture, a mood board, or any reference image.

### Quick Swap

The fastest way to customize: just edit `marcus-aurelius-brand.md` with your brand's colors, fonts, and voice. The other files add depth but aren't strictly required — the AI will still generate good output from the brand markdown alone.

---

## Project Structure

```
src/
  app/
    page.tsx                    # Main UI — prompt input, blueprint editor, progress, download
    api/
      plan/route.ts             # Blueprint generation endpoint
      generate/route.ts         # Kicks off site/landing page generation
      download/route.ts         # Serves generated files
      status/route.ts           # Polling endpoint for generation progress
  components/
    prompt-input.tsx            # Model selector, mode toggle, prompt field
    blueprint-editor.tsx        # Full website blueprint editor
    landing-blueprint-editor.tsx # Landing page blueprint editor
    generation-progress.tsx     # Live progress tracking UI
    download-ready.tsx          # Download button and import instructions
  lib/
    brand/                      # Brand assets (replace with your own)
      index.ts                  # Barrel export — loads files as raw strings / base64
      marcus-aurelius-brand.md  # Brand identity
      brand-voice.yaml          # Voice profile
      frontend-design.md        # Design guidelines
      background-texture.png    # Background reference image
      logo-white-noise.png      # Logo reference image
    prompts/
      landing-content-system.ts # System prompt for landing page JSON generation
      landing-plan-system.ts    # System prompt for landing page blueprints
      plan-system.ts            # System prompt for full website blueprints
      template-system.ts        # System prompt for template/page JSON generation
    generator/
      landing-page-gen.ts       # Landing page generation pipeline
      template-gen.ts           # Template generation (header, footer, archives)
      page-content-gen.ts       # Page content generation
      generate-elements.ts      # Shared element generation (Claude/Gemini dual strategy)
      site-settings-gen.ts      # Global site settings generation
      index.ts                  # Full website generation orchestrator
    ai-provider.ts              # Multi-provider model setup (Anthropic + Google)
    job-store.ts                # In-memory job state management
    post-processor.ts           # JSON validation, normalization, fixups
    id-manager.ts               # Element/post ID allocation
    zip-bundler.ts              # Site kit ZIP assembly
    types.ts                    # TypeScript interfaces
```

---

## Tech Stack

- **Next.js 16** with Turbopack
- **React 19** + TypeScript
- **Tailwind CSS v4**
- **Vercel AI SDK** (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/google`)
- **Zod v4** for schema validation
- **JSZip** for site kit bundling

---

## Importing into WordPress

### Landing Page
1. In WordPress, go to **Elementor > My Templates**
2. Click **Import Templates**
3. Upload the downloaded `.json` file
4. Insert the template into any page

### Full Website (Site Kit)
1. In WordPress, go to **Elementor > Kit Library**
2. Click **Import Kit** (or use the import option in Elementor settings)
3. Upload the downloaded `.zip` file
4. Choose which parts to import (templates, content, site settings)

> **Note:** Requires **Elementor Pro** for full compatibility (forms, theme builder templates, nested widgets).

---

## Example Prompts

**Landing page:**
- "A SaaS landing page for a project management tool called TaskFlow with pricing, testimonials, and FAQ"
- "Real estate agent landing page for luxury properties in Miami with contact form and gallery"
- "SEO agency landing page with case studies, pricing tiers, and a free audit CTA"

**Full website:**
- "A photography portfolio website with gallery, about page, contact, and blog"
- "E-commerce site for handmade candles with product showcase, about us, and FAQ"
- "Digital marketing agency website with services, case studies, team, and blog"

---

## Reference Files

The `Landing Page Examples/` folder contains 4 real Elementor Pro landing page JSON exports (Real Estate, SaaS, SEO, Consultant) used as reference during development. These show the exact JSON structure, widget patterns, and styling conventions that the generator targets.

The `Example website/` folder contains a reference Elementor Site Kit export showing the full zip structure.

---

## License

MIT
