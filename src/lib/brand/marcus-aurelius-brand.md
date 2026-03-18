---
name: marcus-aurelius-brand
description: >
  Complete brand identity system for Marcus-Aurelius Digital. Use this skill whenever
  creating ANY output for Marc — emails, documents, presentations, social posts,
  web UI, graphics, reports, proposals, or any other deliverable. This skill defines
  the exact colors, fonts, visual style, logo usage, and voice to use. Trigger even
  when the user says "make it on-brand", "in my style", "for my agency", "write this
  for me", or simply starts a task without specifying brand — default to this identity
  for all Marcus-Aurelius Digital work. Also trigger for any content creation, writing,
  design, or workflow task where brand consistency would improve the output.
---

# Marcus-Aurelius Digital — Brand Identity System

## Who This Is

**Brand:** Marcus-Aurelius Digital  
**Founder:** Marc-Aurele Legoux (signs as "Marc-Aurele" in all communications)  
**Business:** Helps brands and businesses scale revenue organically through systems and AI workflows  
**Tagline:** *"AI systems that either save time or make money."* — primary positioning statement  
**Secondary tagline:** *"SEO is still SEO"* — use when contextually relevant in SEO/organic contexts  
**Positioning:** Solo digital-marketing operator. Commercially sharp, technically fluent, human in tone.

---

## Color Palette

| Role | Name | Hex | Usage |
|---|---|---|---|
| **Primary / Background** | Void Black | `#242424` | Page backgrounds, dark sections, primary surfaces |
| **Secondary / Text** | Chalk White | `#F4F4F4` | Body text, headings on dark, reversed UI |
| **Accent** | Gold | `#F2B705` | CTAs, highlights, key data points, active states |
| **Overlay / Depth** | Deep Forest | `#1A2E1A` (approx) | Subtle tinted overlays, gradient origins (see texture) |

**Color rules:**
- Default canvas is dark: `#242424` background with `#F4F4F4` text
- Gold (`#F2B705`) is used sparingly — one focal point per layout, not as fill
- Never use white text on light backgrounds; always invert
- For web/UI: dark mode first, always

---

## Typography

| Role | Font | Weight | Usage |
|---|---|---|---|
| **Heading** | SUSE | Bold (700) | All headings H1–H3, slide titles, hero text |
| **Body** | Lato | Regular (400) | Body copy, paragraphs, captions |
| **UI / Labels** | Lato | Medium (500) or Bold (700) | Buttons, tags, metadata, table headers |

**Type rules:**
- Sentence case throughout — never title case except for proper nouns and acronyms
- Headings: SUSE Bold, large, generous spacing
- Body: Lato Regular, comfortable line height (~1.6)
- Acronyms in all-caps: SEO, KPI, CPA, UGC, AI, MRR
- Avoid mixing more than 2 weights per layout

**Google Fonts import (for web/HTML):**
```html
<link href="https://fonts.googleapis.com/css2?family=SUSE:wght@700&family=Lato:wght@400;500;700&display=swap" rel="stylesheet">
```

---

## Visual Style

**Aesthetic:** Clean, modern, minimal — negative-space dominant  
**Texture:** Subtle noise/grain overlays on gradients (not flat — always slightly textured)  
**Depth:** Dark radial gradients with warm gold or cool green tints bleeding in from corners  
**Contrast:** High contrast — near-black backgrounds, near-white text, gold accents pop  
**Imagery:** Data-forward, precision, systems — not stock-photo warm  

### Signature Background Treatment
The brand's signature background is a **dark noise gradient**: near-black base with a soft radial warm-gold glow toward center-bottom and a deep forest-green tint bleeding in from the top-left corner. Fine grain/noise texture is applied over the entire surface (not smooth gradients — always textured).

→ Reference file: `assets/background-texture.png`  
→ Replicate in CSS with: dark base + radial gradient + SVG/CSS noise filter  

```css
/* Approximate CSS recreation */
background-color: #242424;
background-image: 
  radial-gradient(ellipse at 60% 70%, rgba(100, 80, 10, 0.35) 0%, transparent 60%),
  radial-gradient(ellipse at 5% 5%, rgba(20, 60, 20, 0.4) 0%, transparent 50%),
  url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.08'/%3E%3C/svg%3E");
```

---

## Logo

**Name:** Marcus-Aurelius Digital — White Noise Logo  
**Style:** Abstract letterform icon — lion/shield motif built from a grid of micro-text characters creating a white noise texture effect. White on black only.  
**File:** `assets/logo-white-noise.png`  

**Logo usage rules:**
- Use on dark backgrounds (`#242424` or darker) only — this is a white-on-black mark
- Do not place on light or gold backgrounds
- Maintain clear space equal to 1× the logo width on all sides
- Never recolor, stretch, or add drop shadows
- Icon-only usage is fine for small sizes, favicons, and avatars
- No wordmark exists separately — the icon IS the mark

---

## Voice & Tone

Full voice profile: `references/brand-voice.yaml`

### Quick Reference

**Personality in 5 words:** Direct. Warm. Sharp. Commercial. Human.

**Register:** Relaxed business casual by default. Shifts formal only for cold outreach to large brands.

**The non-negotiables:**
- Lead with the answer, price, or deliverable — context comes second
- Specific numbers always beat vague claims ("40% lift" not "strong results")
- Short by default — expand only for proposals and KPI reports
- One main ask per piece; secondary asks go in a PS
- No AI vocabulary: no *leverage, delve, robust, holistic, transformative, seamless*

**Signature phrases to use:**
- "Let me know what you think."
- "Let me know if you have any questions."
- "In my experience..."
- "Kind regards, Marc" (default sign-off)
- "SEO is still SEO" (positioning, use sparingly)
- "quick catch-up / jump on a call"

**Banned phrases:**
- "I hope this email finds you well"
- "Please do not hesitate to contact me"
- "In today's digital landscape"
- "In summary / In conclusion"
- "Moving forward"
- "As per my previous email"
- Any recap intro that re-explains what the reader already knows

**Emoji policy:** Rare and conversational only (`:D`, `😊`). Never in formal reports or invoices.

---

## Output Templates by Format

### Email
- Open: `Hi [Name],` (default) or `Hey [Name],` (repeat contact)
- Body: Answer first, context second. Bullets for lists only.
- Close: `Kind regards, Marc-Aurele` (default)
- PS: Use for secondary asks instead of crowding the main body

### Document / Report
- Dark background (`#242424`) with `#F4F4F4` text
- SUSE Bold headings, Lato body
- Gold (`#F2B705`) for key metrics, highlights, and CTAs
- TL;DR section at top for any report over 2 pages
- No padding paragraphs — cut if it can't be made concrete

### Presentation / Slides
- Dark canvas with noise gradient background (see `assets/background-texture.png`)
- Logo top-left or bottom-right corner
- One key idea per slide — negative space is intentional
- Gold accent for the single most important number or phrase per slide
- SUSE Bold for titles, Lato for supporting text

### Web / UI
- Dark mode first: `#242424` base, `#F4F4F4` text, `#F2B705` CTA buttons
- SUSE Bold for hero headlines, Lato for UI copy
- Noise gradient for hero sections and hero backgrounds
- Minimal decoration — let whitespace (darkspace) breathe

### Social / Short-form
- Dark or gradient background when creating graphics
- One bold statement per frame — SUSE Bold, large
- Gold used for emphasis word or stat only
- Voice: punchy, direct, no filler

---

## What to Always Remember

1. **Dark-first** — every canvas starts `#242424`
2. **Gold is for one thing per layout** — the most important element
3. **Noise texture** — never fully flat gradients; always slight grain
4. **SUSE for impact, Lato for everything else**
5. **Voice: lead with the point, cut the padding, name the numbers**
6. **Marc-Aurele signs as "Marc-Aurele"** in all content and communications
7. **Logo is white-on-dark only** — never reverse or recolor
