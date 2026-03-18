/**
 * Generates valid WXR (WordPress eXtended RSS) 1.2 XML files.
 *
 * WXR is the format WordPress uses for content export/import.
 * All string values are CDATA-wrapped for safety.
 * ACF custom fields come in pairs: fieldname (value) + _fieldname (field key).
 */

// ─── Types ────────────────────────────────────────────────────────

export interface WxrOptions {
  siteName: string;
  siteUrl: string;
  author: {
    login: string;
    email: string;
    displayName: string;
  };
  items: WxrItem[];
  categories?: WxrCategory[];
}

export interface WxrItem {
  postId: number;
  title: string;
  slug: string;
  postType: string;
  status: string;
  content?: string;
  excerpt?: string;
  menuOrder?: number;
  parentId?: number;
  postMeta?: WxrPostMeta[];
  categories?: { domain: string; slug: string; name: string }[];
  attachmentUrl?: string;
}

export interface WxrPostMeta {
  key: string;
  value: string;
}

export interface WxrCategory {
  termId: number;
  slug: string;
  name: string;
  taxonomy: string;
  parent?: string;
}

// ─── XML Builder ──────────────────────────────────────────────────

function cdata(value: string): string {
  return `<![CDATA[${value}]]>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildItemXml(item: WxrItem, authorLogin: string): string {
  const lines: string[] = [];
  lines.push("    <item>");
  lines.push(`      <title>${cdata(item.title)}</title>`);
  lines.push(`      <link></link>`);
  lines.push(`      <pubDate></pubDate>`);
  lines.push(`      <dc:creator>${cdata(authorLogin)}</dc:creator>`);
  lines.push(`      <guid isPermaLink="false"></guid>`);
  lines.push(`      <description></description>`);
  lines.push(`      <content:encoded>${cdata(item.content || "")}</content:encoded>`);
  lines.push(`      <excerpt:encoded>${cdata(item.excerpt || "")}</excerpt:encoded>`);
  lines.push(`      <wp:post_id>${item.postId}</wp:post_id>`);
  const dateStr = new Date().toISOString().replace("T", " ").substring(0, 19);
  lines.push(`      <wp:post_date>${cdata(dateStr)}</wp:post_date>`);
  lines.push(`      <wp:post_date_gmt>${cdata(dateStr)}</wp:post_date_gmt>`);
  lines.push(`      <wp:post_modified>${cdata(dateStr)}</wp:post_modified>`);
  lines.push(`      <wp:post_modified_gmt>${cdata(dateStr)}</wp:post_modified_gmt>`);
  lines.push(`      <wp:comment_status>${cdata("closed")}</wp:comment_status>`);
  lines.push(`      <wp:ping_status>${cdata("closed")}</wp:ping_status>`);
  lines.push(`      <wp:post_name>${cdata(item.slug)}</wp:post_name>`);
  lines.push(`      <wp:status>${cdata(item.status)}</wp:status>`);
  lines.push(`      <wp:post_parent>${cdata(String(item.parentId || 0))}</wp:post_parent>`);
  lines.push(`      <wp:menu_order>${item.menuOrder || 0}</wp:menu_order>`);
  lines.push(`      <wp:post_type>${cdata(item.postType)}</wp:post_type>`);
  lines.push(`      <wp:post_password>${cdata("")}</wp:post_password>`);
  lines.push(`      <wp:is_sticky>0</wp:is_sticky>`);

  // Attachment URL (for media items)
  if (item.attachmentUrl) {
    lines.push(`      <wp:attachment_url>${cdata(item.attachmentUrl)}</wp:attachment_url>`);
  }

  // Category/taxonomy terms on this item
  if (item.categories) {
    for (const cat of item.categories) {
      lines.push(
        `      <category domain="${escapeXml(cat.domain)}" nicename="${escapeXml(cat.slug)}">${cdata(cat.name)}</category>`
      );
    }
  }

  // Post meta
  if (item.postMeta) {
    for (const meta of item.postMeta) {
      lines.push("      <wp:postmeta>");
      lines.push(`        <wp:meta_key>${cdata(meta.key)}</wp:meta_key>`);
      lines.push(`        <wp:meta_value>${cdata(meta.value)}</wp:meta_value>`);
      lines.push("      </wp:postmeta>");
    }
  }

  lines.push("    </item>");
  return lines.join("\n");
}

function buildCategoryXml(cat: WxrCategory): string {
  const lines: string[] = [];
  const tag = cat.taxonomy === "category" ? "wp:category" : "wp:term";

  lines.push(`    <${tag}>`);
  lines.push(`      <wp:term_id>${cat.termId}</wp:term_id>`);
  lines.push(`      <wp:category_nicename>${cdata(cat.slug)}</wp:category_nicename>`);

  if (cat.taxonomy !== "category") {
    lines.push(`      <wp:term_taxonomy>${cdata(cat.taxonomy)}</wp:term_taxonomy>`);
  }

  if (cat.parent) {
    lines.push(`      <wp:category_parent>${cdata(cat.parent)}</wp:category_parent>`);
  }

  lines.push(`      <wp:cat_name>${cdata(cat.name)}</wp:cat_name>`);
  lines.push(`    </${tag}>`);

  return lines.join("\n");
}

// ─── Main Export ──────────────────────────────────────────────────

export function buildWxrXml(options: WxrOptions): string {
  const { siteName, siteUrl, author, items, categories } = options;

  const header = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/"
>
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description></description>
    <pubDate></pubDate>
    <language>en-US</language>
    <wp:wxr_version>1.2</wp:wxr_version>
    <wp:base_site_url>${escapeXml(siteUrl)}</wp:base_site_url>
    <wp:base_blog_url>${escapeXml(siteUrl)}</wp:base_blog_url>

    <wp:author>
      <wp:author_id>1</wp:author_id>
      <wp:author_login>${cdata(author.login)}</wp:author_login>
      <wp:author_email>${cdata(author.email)}</wp:author_email>
      <wp:author_display_name>${cdata(author.displayName)}</wp:author_display_name>
      <wp:author_first_name>${cdata("")}</wp:author_first_name>
      <wp:author_last_name>${cdata("")}</wp:author_last_name>
    </wp:author>`;

  const categoryXml = categories
    ? "\n\n" + categories.map(buildCategoryXml).join("\n\n")
    : "";

  const itemsXml = items.map((item) => buildItemXml(item, author.login)).join("\n\n");

  const footer = `
  </channel>
</rss>`;

  return header + categoryXml + "\n\n" + itemsXml + footer;
}
