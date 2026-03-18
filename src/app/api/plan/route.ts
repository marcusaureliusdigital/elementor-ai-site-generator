import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { getModel, type ModelId } from "@/lib/ai-provider";
import { z } from "zod";
import { PLAN_SYSTEM_PROMPT } from "@/lib/prompts/plan-system";
import { LANDING_PLAN_SYSTEM_PROMPT } from "@/lib/prompts/landing-plan-system";
import { MARCUS_AURELIUS_BRAND, BRAND_VOICE } from "@/lib/brand";
import { IdManager } from "@/lib/id-manager";
import type {
  SiteBlueprint,
  LandingPageBlueprint,
  GenerationMode,
  PageDef,
  PostDef,
  CptDef,
  CategoryDef,
  TemplateDef,
  PluginDef,
  TemplateCondition,
} from "@/lib/types";

// ── Zod Schemas (for LLM structured output) ──────────────────────

const ColorsSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  text: z.string(),
  accent: z.string(),
  background: z.string(),
  black: z.string(),
  white: z.string(),
});

const TypographySchema = z.object({
  headingFont: z.string(),
  bodyFont: z.string(),
});

const PageSchema = z.object({
  title: z.string(),
  slug: z.string(),
  isHome: z.boolean(),
  sections: z.array(z.string()),
});

const PostSchema = z.object({
  title: z.string(),
  slug: z.string(),
  category: z.string(),
  excerpt: z.string(),
});

const CptFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["text", "textarea", "image", "date", "relationship"]),
});

const CptPostSchema = z.object({
  title: z.string(),
  slug: z.string(),
  fields: z.array(z.object({
    key: z.string(),
    value: z.string(),
  })),
});

const CptSchema = z.object({
  name: z.string(),
  label: z.string(),
  singularLabel: z.string(),
  fields: z.array(CptFieldSchema),
  posts: z.array(CptPostSchema),
});

const CategorySchema = z.object({
  name: z.string(),
  slug: z.string(),
  taxonomy: z.string(),
});

const SocialLinksSchema = z.object({
  instagram: z.string().optional(),
  twitter: z.string().optional(),
  youtube: z.string().optional(),
  pinterest: z.string().optional(),
});

const BlueprintResponseSchema = z.object({
  name: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  colors: ColorsSchema,
  typography: TypographySchema,
  pages: z.array(PageSchema),
  posts: z.array(PostSchema),
  customPostTypes: z.array(CptSchema),
  categories: z.array(CategorySchema),
  hasContactForm: z.boolean(),
  hasBlog: z.boolean(),
  socialLinks: SocialLinksSchema,
});

// ── Helpers ────────────────────────────────────────────────────────

function buildTemplates(
  pages: PageDef[],
  cpts: CptDef[],
  hasBlog: boolean,
  idMgr: IdManager
): TemplateDef[] {
  const templates: TemplateDef[] = [];

  // Header (global)
  templates.push({
    id: idMgr.allocatePostId(),
    title: "Header",
    docType: "header",
    location: "header",
    conditions: [{ type: "include", name: "general", sub_name: "", sub_id: "" }],
  });

  // Footer (global)
  templates.push({
    id: idMgr.allocatePostId(),
    title: "Footer",
    docType: "footer",
    location: "footer",
    conditions: [{ type: "include", name: "general", sub_name: "", sub_id: "" }],
  });

  // Single post template (if blog)
  if (hasBlog) {
    templates.push({
      id: idMgr.allocatePostId(),
      title: "Single Post",
      docType: "single-post",
      location: "single",
      conditions: [{ type: "include", name: "singular", sub_name: "post", sub_id: "" }],
    });

    // Post archive
    templates.push({
      id: idMgr.allocatePostId(),
      title: "Blog Archive",
      docType: "archive",
      location: "archive",
      conditions: [{ type: "include", name: "archive", sub_name: "post", sub_id: "" }],
    });

    // Post loop item
    templates.push({
      id: idMgr.allocatePostId(),
      title: "Post Loop Item",
      docType: "loop-item",
      location: "",
      conditions: [],
    });
  }

  // CPT templates
  for (const cpt of cpts) {
    // Single CPT template
    templates.push({
      id: idMgr.allocatePostId(),
      title: `Single ${cpt.singularLabel}`,
      docType: "single-post",
      location: "single",
      conditions: [
        { type: "include", name: "singular", sub_name: cpt.name, sub_id: "" },
      ],
    });

    // CPT archive
    templates.push({
      id: idMgr.allocatePostId(),
      title: `${cpt.label} Archive`,
      docType: "archive",
      location: "archive",
      conditions: [
        { type: "include", name: "archive", sub_name: cpt.name, sub_id: "" },
      ],
    });

    // CPT loop item
    templates.push({
      id: idMgr.allocatePostId(),
      title: `${cpt.singularLabel} Loop Item`,
      docType: "loop-item",
      location: "",
      conditions: [],
    });
  }

  // 404 page
  templates.push({
    id: idMgr.allocatePostId(),
    title: "404 Page",
    docType: "error-404",
    location: "single",
    conditions: [{ type: "include", name: "singular", sub_name: "not_found404", sub_id: "" }],
  });

  return templates;
}

function buildPlugins(cpts: CptDef[], hasForm: boolean): PluginDef[] {
  const plugins: PluginDef[] = [
    {
      name: "Elementor",
      plugin: "elementor/elementor.php",
      pluginUri: "https://elementor.com/",
      version: "3.35.7",
    },
    {
      name: "Elementor Pro",
      plugin: "elementor-pro/elementor-pro.php",
      pluginUri: "https://elementor.com/",
      version: "3.35.7",
    },
  ];

  if (cpts.length > 0) {
    plugins.push({
      name: "Advanced Custom Fields PRO",
      plugin: "advanced-custom-fields-pro/acf.php",
      pluginUri: "https://www.advancedcustomfields.com/",
      version: "6.3.12",
    });
  }

  // Contact form is handled by Elementor Pro, already included above

  return plugins;
}

// ── Landing Page Zod Schema ────────────────────────────────────────

const LandingBlueprintResponseSchema = z.object({
  name: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  colors: ColorsSchema,
  typography: TypographySchema,
  sections: z.array(z.string()),
  hasContactForm: z.boolean(),
  socialLinks: z.object({
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    youtube: z.string().optional(),
  }),
});

// ── API Route ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, modelId: rawModelId, mode: rawMode } = body;
    const modelId: ModelId = rawModelId || "claude-opus-4-6";
    const mode: GenerationMode = rawMode || "website";

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid prompt" },
        { status: 400 }
      );
    }

    // ── Brand context for planning ────────────────────────────────
    const brandContext = `# Brand Identity Reference\n${MARCUS_AURELIUS_BRAND}\n\n# Brand Voice Reference\n${BRAND_VOICE}\n\n---\n\n`;

    // ── Landing Page Mode ──────────────────────────────────────────
    if (mode === "landing-page") {
      const { object: rawLandingBlueprint } = await generateObject({
        model: getModel(modelId),
        schema: LandingBlueprintResponseSchema,
        system: brandContext + LANDING_PLAN_SYSTEM_PROMPT,
        prompt: `Create a detailed landing page blueprint for the following request:\n\n${prompt}`,
      });

      const landingBlueprint: LandingPageBlueprint = {
        ...rawLandingBlueprint,
      };

      return NextResponse.json({ blueprint: landingBlueprint, mode: "landing-page" });
    }

    // ── Full Website Mode ──────────────────────────────────────────
    const { object: rawBlueprint } = await generateObject({
      model: getModel(modelId),
      schema: BlueprintResponseSchema,
      system: brandContext + PLAN_SYSTEM_PROMPT,
      prompt: `Create a detailed website blueprint for the following request:\n\n${prompt}`,
    });

    // Now allocate all IDs server-side
    const idMgr = new IdManager(10);

    // Allocate page IDs
    const pages: PageDef[] = rawBlueprint.pages.map((p) => ({
      ...p,
      id: idMgr.allocatePostId(),
    }));

    // Allocate post IDs
    const posts: PostDef[] = rawBlueprint.posts.map((p) => ({
      ...p,
      id: idMgr.allocatePostId(),
    }));

    // Allocate CPT IDs (posts + fields)
    const customPostTypes: CptDef[] = rawBlueprint.customPostTypes.map((cpt) => ({
      ...cpt,
      fields: cpt.fields.map((f) => ({
        ...f,
        fieldId: idMgr.generateFieldKey(),
      })),
      posts: cpt.posts.map((p) => {
        const fieldsRecord: Record<string, string> = {};
        for (const f of p.fields) {
          fieldsRecord[f.key] = f.value;
        }
        return {
          ...p,
          fields: fieldsRecord,
          id: idMgr.allocatePostId(),
          thumbnailId: idMgr.allocatePostId(),
        };
      }),
    }));

    // Allocate category term IDs
    const categories: CategoryDef[] = rawBlueprint.categories.map((c) => ({
      ...c,
      termId: idMgr.allocateTermId(),
      parent: 0,
    }));

    // Build templates with IDs
    const templates = buildTemplates(pages, customPostTypes, rawBlueprint.hasBlog, idMgr);

    // Build plugin list
    const plugins = buildPlugins(customPostTypes, rawBlueprint.hasContactForm);

    // Assemble full blueprint
    const blueprint: SiteBlueprint = {
      name: rawBlueprint.name,
      slug: rawBlueprint.slug,
      title: rawBlueprint.title,
      description: rawBlueprint.description,
      siteUrl: "https://example.com",
      author: {
        name: "Admin",
        login: "admin",
        email: "admin@example.com",
      },
      colors: rawBlueprint.colors,
      typography: rawBlueprint.typography,
      pages,
      posts,
      customPostTypes,
      categories,
      templates,
      plugins,
      hasContactForm: rawBlueprint.hasContactForm,
      hasBlog: rawBlueprint.hasBlog,
      socialLinks: rawBlueprint.socialLinks,
    };

    return NextResponse.json({ blueprint, mode: "website" });
  } catch (error) {
    console.error("Plan generation error:", error);

    const message = error instanceof Error ? error.message : String(error);

    let userMessage = `Failed to generate blueprint: ${message}`;
    if (message.includes("API key") || message.includes("authentication") || message.includes("401")) {
      userMessage = "Failed to generate blueprint: API key configuration issue. Check your .env.local file.";
    } else if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
      userMessage = "Failed to generate blueprint: request timed out, please try again";
    }

    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}
