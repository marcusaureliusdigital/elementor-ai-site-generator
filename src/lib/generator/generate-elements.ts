/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateText } from "ai";
import { getModel, type ModelId } from "../ai-provider";
import { BRAND_SYSTEM_PREFIX } from "../brand";

/**
 * Extract JSON from LLM response text — handles markdown code fences and raw JSON.
 */
function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0].trim();
  return text.trim();
}

/**
 * Generates Elementor element JSON via plain text generation + JSON.parse.
 *
 * Why not generateObject + recursive Zod? The Vercel AI SDK's JSON-Schema
 * converter rejects `z.lazy()` self-references with "Circular reference
 * detected in schema definitions: __schema0 -> __schema0", and a non-recursive
 * `z.array(z.any())` schema causes Claude to flatten the tree (see prior
 * incident). Plain text generation lets the recursive shape come through as
 * the LLM naturally writes it. The tree-shape validator in post-processor.ts
 * + retry loop catches any flat output and forces a re-emit.
 *
 * Returns the raw parsed object with { content, settings?, metadata? }.
 */
export async function generateElementJson(
  _modelId: ModelId,
  system: string,
  prompt: string
): Promise<{ content: any[]; settings?: any; metadata?: any }> {
  const fullSystem = BRAND_SYSTEM_PREFIX + system;

  const { text } = await generateText({
    model: getModel(_modelId),
    system: fullSystem,
    prompt:
      prompt +
      "\n\nReturn ONLY valid JSON. No markdown code fences, no explanation. The JSON must be a single object with shape { content: [...], settings: {...}, metadata: [...] }. The `content` array contains a TREE of elements — every container nests its children inside its own `elements` field, recursively. Widgets always have `elements: []`.",
  });

  const jsonStr = extractJson(text);
  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Invalid JSON from LLM: ${(e as Error).message}`);
  }

  if (!parsed.content || !Array.isArray(parsed.content)) {
    throw new Error("Response missing 'content' array");
  }

  return parsed;
}
