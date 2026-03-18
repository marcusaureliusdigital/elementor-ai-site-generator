import { NextResponse } from "next/server";
import { bundleSiteKit } from "@/lib/zip-bundler";
import { buildWxrXml } from "@/lib/templates/wxr-boilerplate";
import { ELEMENTOR_EXPERIMENTS } from "@/lib/constants";
import type { SiteKitFiles } from "@/lib/types";

/**
 * GET /api/download-test
 *
 * Returns a hardcoded minimal site kit zip for import testing.
 * This proves the zip structure is valid before wiring up LLM generation.
 */
export async function GET() {
  // ── Hardcoded test data ──────────────────────────────────────

  const siteSettings = JSON.stringify({
    content: [],
    settings: {
      system_colors: [
        { _id: "primary", title: "Primary", color: "#FF8534" },
        { _id: "secondary", title: "Secondary", color: "#FFF1DC" },
        { _id: "text", title: "Text", color: "#333333" },
        { _id: "accent", title: "Accent", color: "#FF8534" },
      ],
      custom_colors: [
        { _id: "c100ccf", title: "Background", color: "#FEFBF6" },
        { _id: "3418c78", title: "Black", color: "#000000" },
        { _id: "68d7fc5", title: "White", color: "#FFFFFF" },
      ],
      system_typography: [
        {
          _id: "primary",
          title: "Primary",
          typography_typography: "custom",
          typography_font_family: "Roboto",
          typography_font_weight: "600",
        },
        {
          _id: "secondary",
          title: "Secondary",
          typography_typography: "custom",
          typography_font_family: "Roboto",
          typography_font_weight: "400",
        },
        {
          _id: "text",
          title: "Text",
          typography_typography: "custom",
          typography_font_family: "Roboto",
          typography_font_weight: "400",
        },
        {
          _id: "accent",
          title: "Accent",
          typography_typography: "custom",
          typography_font_family: "Roboto",
          typography_font_weight: "500",
        },
      ],
    },
    metadata: [],
  });

  // Minimal header template
  const headerTemplate = JSON.stringify({
    content: [
      {
        id: "a1b2c3d4",
        elType: "container",
        isInner: false,
        settings: {
          content_width: "full",
          flex_direction: "row",
          flex_justify_content: "space-between",
          flex_align_items: "center",
          padding: { unit: "px", top: "15", right: "30", bottom: "15", left: "30" },
          background_background: "classic",
          background_color: { r: 255, g: 255, b: 255, a: 1 },
        },
        elements: [
          {
            id: "e5f6a7b8",
            elType: "widget",
            widgetType: "theme-site-logo",
            settings: {
              width: { unit: "px", size: 120 },
              align: "left",
              __dynamic__: {
                title: "[elementor-tag id=\"e5f6a7b8\" name=\"site-logo\" settings=\"%7B%7D\"]",
              },
            },
            elements: [],
          },
          {
            id: "c9d0e1f2",
            elType: "widget",
            widgetType: "nav-menu",
            settings: {
              menu: "main-menu",
              layout: "horizontal",
              align_items: "center",
              pointer: "underline",
            },
            elements: [],
          },
        ],
      },
    ],
    settings: [],
    metadata: [],
  });

  // Minimal footer template
  const footerTemplate = JSON.stringify({
    content: [
      {
        id: "11223344",
        elType: "container",
        isInner: false,
        settings: {
          content_width: "full",
          padding: { unit: "px", top: "40", right: "30", bottom: "40", left: "30" },
          background_background: "classic",
          background_color: "#000000",
        },
        elements: [
          {
            id: "55667788",
            elType: "widget",
            widgetType: "heading",
            settings: {
              title: "© 2025 Test Site. All rights reserved.",
              align: "center",
              title_color: "#FFFFFF",
              typography_typography: "custom",
              typography_font_size: { unit: "px", size: 14 },
            },
            elements: [],
          },
        ],
      },
    ],
    settings: [],
    metadata: [],
  });

  // Minimal home page content
  const homePageContent = JSON.stringify({
    content: [
      {
        id: "aabbccdd",
        elType: "container",
        isInner: false,
        settings: {
          content_width: "boxed",
          min_height: { unit: "vh", size: 60 },
          flex_direction: "column",
          flex_justify_content: "center",
          flex_align_items: "center",
          padding: { unit: "px", top: "80", right: "30", bottom: "80", left: "30" },
        },
        elements: [
          {
            id: "eeff0011",
            elType: "widget",
            widgetType: "heading",
            settings: {
              title: "Welcome to Test Site",
              align: "center",
              header_size: "h1",
              typography_typography: "custom",
              typography_font_family: "Roboto",
              typography_font_size: { unit: "px", size: 48 },
              typography_font_weight: "700",
            },
            elements: [],
          },
          {
            id: "22334455",
            elType: "widget",
            widgetType: "text-editor",
            settings: {
              editor: "<p>This is a test site generated by Elementor AI Site Generator.</p>",
              align: "center",
            },
            elements: [],
          },
        ],
      },
    ],
    settings: [],
    metadata: [],
  });

  // WXR files
  const wxrAuthor = {
    login: "admin",
    email: "admin@test.com",
    displayName: "Admin",
  };

  const pageWxr = buildWxrXml({
    siteName: "Test Site",
    siteUrl: "https://test.com",
    author: wxrAuthor,
    items: [
      {
        postId: 14,
        title: "Home",
        slug: "home",
        postType: "page",
        status: "publish",
        content: "",
        postMeta: [
          { key: "_elementor_edit_mode", value: "builder" },
          { key: "_elementor_template_type", value: "wp-page" },
          { key: "_wp_page_template", value: "elementor_header_footer" },
        ],
      },
    ],
  });

  const navMenuWxr = buildWxrXml({
    siteName: "Test Site",
    siteUrl: "https://test.com",
    author: wxrAuthor,
    items: [
      {
        postId: 100,
        title: "Home",
        slug: "home",
        postType: "nav_menu_item",
        status: "publish",
        menuOrder: 1,
        postMeta: [
          { key: "_menu_item_type", value: "post_type" },
          { key: "_menu_item_object", value: "page" },
          { key: "_menu_item_object_id", value: "14" },
          { key: "_menu_item_menu_item_parent", value: "0" },
          { key: "_menu_item_classes", value: "a:1:{i:0;s:0:\"\";}" },
          { key: "_menu_item_xfn", value: "" },
          { key: "_menu_item_url", value: "" },
        ],
        categories: [
          { domain: "nav_menu", slug: "main-menu", name: "Main Menu" },
        ],
      },
    ],
  });

  // Manifest — must match real Elementor export format
  const manifest = JSON.stringify({
    name: "test-site",
    title: "Test Site",
    description: "A test site generated for validation",
    author: "Admin",
    version: "3.0",
    elementor_version: "3.35.7",
    created: new Date().toISOString().replace("T", " ").substring(0, 19),
    thumbnail: false,
    site: "https://test.com",
    theme: {
      name: "Hello Elementor",
      theme_uri: "https://elementor.com/hello-theme/",
      version: "3.4.6",
      slug: "hello-elementor",
    },
    experiments: [...ELEMENTOR_EXPERIMENTS],
    "site-settings": {
      theme: true,
      globalColors: true,
      globalFonts: true,
      themeStyleSettings: true,
      generalSettings: true,
      experiments: true,
      customCode: true,
      customIcons: true,
      customFonts: true,
    },
    plugins: [
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
    ],
    templates: {
      "500": {
        title: "Header",
        doc_type: "header",
        thumbnail: false,
        location: "header",
        conditions: [{ type: "include", name: "general", sub_name: "", sub_id: "" }],
      },
      "501": {
        title: "Footer",
        doc_type: "footer",
        thumbnail: false,
        location: "footer",
        conditions: [{ type: "include", name: "general", sub_name: "", sub_id: "" }],
      },
    },
    taxonomies: {
      nav_menu_item: [{ name: "nav_menu", label: "Navigation Menus" }],
    },
    content: {
      page: {
        "14": {
          title: "Home",
          excerpt: "",
          doc_type: "wp-page",
          thumbnail: false,
          url: "https://test.com/",
          terms: [],
          show_on_front: true,
        },
      },
      post: [],
      "e-floating-buttons": [],
      "elementor_component": [],
    },
    "wp-content": {
      page: { "14": { id: 14, title: "Home" } },
      nav_menu_item: { "100": { id: 100, title: "Home" } },
    },
    "custom-post-type-title": {},
    "custom-fonts": {},
    "custom-code": {},
  });

  const taxonomies = {
    nav_menu: JSON.stringify([
      {
        term_id: 16,
        name: "Main Menu",
        slug: "main-menu",
        taxonomy: "nav_menu",
        description: "",
        parent: 0,
      },
    ]),
  };

  // ── Bundle ──────────────────────────────────────────────────────

  const files: SiteKitFiles = {
    manifest,
    siteSettings,
    customCode: JSON.stringify([]),
    customFonts: JSON.stringify([]),
    templates: {
      "500": headerTemplate,
      "501": footerTemplate,
    },
    taxonomies,
    contentPages: {
      "14": homePageContent,
    },
    wpContent: {
      "page/page": pageWxr,
      "nav_menu_item/nav_menu_item": navMenuWxr,
    },
  };

  const buffer = await bundleSiteKit(files);

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=test-site-kit.zip",
      "Content-Length": buffer.byteLength.toString(),
    },
  });
}
