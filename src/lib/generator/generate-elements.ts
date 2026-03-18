import { generateObject, generateText } from "ai";
import { getModel, type ModelId } from "../ai-provider";
import { z } from "zod";
import { MARCUS_AURELIUS_BRAND, FRONTEND_DESIGN, BRAND_VOICE } from "../brand";

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

const ElementSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string(),
    elType: z.enum(["container", "widget", "column", "section"]),
    isInner: z.boolean().optional(),
    widgetType: z.string().optional(),
    settings: z.string().optional(),
    elements: z.array(ElementSchema),
  })
);

/**
 * Recover stringified settings into proper JSON objects (recursively).
 */
function recoverSettings(element: any) {
  if (element.settings && typeof element.settings === "string") {
    try {
      element.settings = JSON.parse(element.settings);
    } catch {
      element.settings = {};
    }
  }
  if (element.elements && Array.isArray(element.elements)) {
    element.elements.forEach(recoverSettings);
  }
}

/**
 * Generates Elementor element JSON using the appropriate method for the model.
 * - Claude: uses generateObject with Zod schema (structured output)
 * - Gemini: uses generateText + JSON parsing (avoids z.lazy() incompatibility)
 *
 * Returns the raw parsed object with { content, settings?, metadata? }.
 */
/** Brand context prepended to all generation system prompts */
const BRAND_SYSTEM_PREFIX = [
  "# Brand Identity & Design Guidelines\n",
  MARCUS_AURELIUS_BRAND,
  "\n\n# Frontend Design Guidelines\n",
  FRONTEND_DESIGN,
  "\n\n# Brand Voice Profile\n",
  BRAND_VOICE,
  "\n\n---\n\n",
].join("");

export async function generateElementJson(
  modelId: ModelId,
  system: string,
  prompt: string
): Promise<{ content: any[]; settings?: any; metadata?: any }> {
  const fullSystem = BRAND_SYSTEM_PREFIX + system;
  const isGemini = modelId.startsWith("gemini");

  if (isGemini) {
    // Gemini: use generateText to avoid z.lazy() schema incompatibility
    const { text } = await generateText({
      model: getModel(modelId),
      system: fullSystem,
      prompt: prompt + "\n\nReturn ONLY valid JSON. No markdown code fences, no explanation.",
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

  // Claude: use generateObject with structured Zod schema
  const { object: rawObject } = await generateObject({
    model: getModel(modelId),
    system: fullSystem,
    prompt,
    schema: z.object({
      content: z.array(ElementSchema),
      settings: z.string().optional(),
      metadata: z.string().optional(),
    }),
  });

  // Process the structured output
  const finalObj: Record<string, any> = { ...rawObject };

  if (finalObj.settings && typeof finalObj.settings === "string") {
    try { finalObj.settings = JSON.parse(finalObj.settings); } catch { finalObj.settings = {}; }
  }

  if (finalObj.metadata && typeof finalObj.metadata === "string") {
    try { finalObj.metadata = JSON.parse(finalObj.metadata); } catch { finalObj.metadata = []; }
  }

  if (finalObj.content && Array.isArray(finalObj.content)) {
    finalObj.content.forEach(recoverSettings);
  }

  return finalObj as { content: any[]; settings?: any; metadata?: any };
}
