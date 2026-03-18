import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Model types ────────────────────────────────────────────────────

export type ModelId = "claude-opus-4-6" | "gemini-3.1-pro-preview";

export const MODEL_OPTIONS: { id: ModelId; label: string; provider: "anthropic" | "google" }[] = [
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic" },
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
    case "claude-opus-4-6":
      return getAnthropicProvider()("claude-opus-4-6");
    case "gemini-3.1-pro-preview":
      return getGoogleProvider()("gemini-3.1-pro-preview");
    default:
      throw new Error(`Unknown model: ${modelId}`);
  }
}

