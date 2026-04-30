import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Model types ────────────────────────────────────────────────────

export type ModelId = "claude-opus-4-7" | "gemini-3.1-pro-preview";

export const MODEL_OPTIONS: { id: ModelId; label: string; provider: "anthropic" | "google" }[] = [
  { id: "claude-opus-4-7", label: "Claude Opus 4.7", provider: "anthropic" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", provider: "google" },
];

// ── Key loaders ────────────────────────────────────────────────────

function loadEnvKey(key: string): string | undefined {
  if (process.env[key]) {
    return process.env[key];
  }
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf-8");
    const match = content.match(new RegExp(`^${key}=(.+)$`, "m"));
    if (match) return match[1].trim();
  } catch {
    // ignore
  }
  return undefined;
}

// ── Provider instances (lazy) ──────────────────────────────────────

let _anthropic: ReturnType<typeof createAnthropic> | null = null;
let _google: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getAnthropicProvider() {
  if (!_anthropic) {
    const key = loadEnvKey("ANTHROPIC_API_KEY");
    if (!key) throw new Error("ANTHROPIC_API_KEY not found in environment or .env.local");
    _anthropic = createAnthropic({
      baseURL: "https://api.anthropic.com/v1",
      apiKey: key,
    });
  }
  return _anthropic;
}

function getGoogleProvider() {
  if (!_google) {
    const key = loadEnvKey("GOOGLE_GENERATIVE_AI_API_KEY");
    if (!key) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not found in environment or .env.local. Add your Gemini API key to .env.local");
    _google = createGoogleGenerativeAI({
      apiKey: key,
    });
  }
  return _google;
}

// ── Model resolver ─────────────────────────────────────────────────

export function getModel(modelId: ModelId) {
  switch (modelId) {
    case "claude-opus-4-7":
      return getAnthropicProvider()("claude-opus-4-7");
    case "gemini-3.1-pro-preview":
      return getGoogleProvider()("gemini-3.1-pro-preview");
    default:
      throw new Error(`Unknown model: ${modelId}`);
  }
}

// ── generateObject hardening for Anthropic ─────────────────────────

/**
 * Force Anthropic's native structured-output path (output_config.format)
 * instead of the legacy "json tool" wrapper. The provider's model-capability
 * lookup in @ai-sdk/anthropic 3.0.58 doesn't yet know about claude-opus-4-7
 * and falls through to a catch-all that disables native structured output —
 * without this override, opus-4-7 ends up calling a tool literally named
 * "json" and wraps its answer as `{"value": {...}}`, which fails schema
 * validation. Forcing "outputFormat" routes us to the same path that already
 * works for opus-4-5 / 4-6.
 *
 * Spread this into the `providerOptions` of every `generateObject` call.
 */
export const anthropicProviderOptions = {
  anthropic: {
    structuredOutputMode: "outputFormat" as const,
  },
};

/**
 * Defensive repair pass for `generateObject` outputs. Strips markdown code
 * fences, leading/trailing prose, and the legacy `{"value": <object>}`
 * envelope emitted by older Anthropic tool-mode paths when the model isn't
 * routed to native structured output. Returns null when nothing useful is
 * recoverable.
 *
 * Pass as `experimental_repairText` on every `generateObject` call.
 */
export async function repairJsonText({ text }: { text: string }): Promise<string | null> {
  let trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) trimmed = fence[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const slice = trimmed.slice(first, last + 1);

  try {
    const parsed = JSON.parse(slice);
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Object.keys(parsed).length === 1 &&
      "value" in parsed &&
      parsed.value &&
      typeof parsed.value === "object"
    ) {
      return JSON.stringify(parsed.value);
    }
  } catch {
    // fall through — return raw slice and let generateObject's parser report
  }
  return slice;
}

