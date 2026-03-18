/**
 * Brand assets for Marcus-Aurelius Digital.
 *
 * Text files (.md, .yaml) are loaded as raw strings for injection into
 * Claude API system prompts. PNG files are loaded as base64 strings for
 * use as image inputs.
 *
 * Server-only — uses fs.readFileSync, do not import from client components.
 */

import { readFileSync } from "fs";
import { join } from "path";

const BRAND_DIR = join(process.cwd(), "src/lib/brand");

/** Brand voice profile (YAML) — tone, vocabulary, interaction patterns */
export const BRAND_VOICE = readFileSync(join(BRAND_DIR, "brand-voice.yaml"), "utf-8");

/** Frontend design skill prompt — aesthetic guidelines, design thinking */
export const FRONTEND_DESIGN = readFileSync(join(BRAND_DIR, "frontend-design.md"), "utf-8");

/** Complete brand identity system — colors, typography, visual style, logo rules, voice */
export const MARCUS_AURELIUS_BRAND = readFileSync(join(BRAND_DIR, "marcus-aurelius-brand.md"), "utf-8");

/** Signature dark noise gradient background texture (base64 PNG) */
export const BACKGROUND_TEXTURE_BASE64 = readFileSync(join(BRAND_DIR, "background-texture.png")).toString("base64");

/** White noise logo mark (base64 PNG) */
export const LOGO_WHITE_NOISE_BASE64 = readFileSync(join(BRAND_DIR, "logo-white-noise.png")).toString("base64");
