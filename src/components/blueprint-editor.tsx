"use client";

import { useState } from "react";
import type { SiteBlueprint, PageDef } from "@/lib/types";

interface BlueprintEditorProps {
  blueprint: SiteBlueprint;
  onApprove: (blueprint: SiteBlueprint) => void;
  onBack: () => void;
}

export function BlueprintEditor({ blueprint, onApprove, onBack }: BlueprintEditorProps) {
  const [bp, setBp] = useState<SiteBlueprint>(blueprint);
  const [isApproving, setIsApproving] = useState(false);

  const updateColors = (key: keyof typeof bp.colors, value: string) => {
    setBp((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
  };

  const updateTypography = (key: keyof typeof bp.typography, value: string) => {
    setBp((prev) => ({ ...prev, typography: { ...prev.typography, [key]: value } }));
  };

  const updatePage = (index: number, field: keyof PageDef, value: string | boolean) => {
    setBp((prev) => {
      const pages = [...prev.pages];
      pages[index] = { ...pages[index], [field]: value };
      return { ...prev, pages };
    });
  };

  const removePage = (index: number) => {
    setBp((prev) => ({
      ...prev,
      pages: prev.pages.filter((_, i) => i !== index),
    }));
  };

  const addPage = () => {
    setBp((prev) => ({
      ...prev,
      pages: [
        ...prev.pages,
        {
          id: 0, // will be reassigned by backend
          title: "New Page",
          slug: "new-page",
          isHome: false,
          sections: [],
        },
      ],
    }));
  };

  const removeCpt = (index: number) => {
    setBp((prev) => ({
      ...prev,
      customPostTypes: prev.customPostTypes.filter((_, i) => i !== index),
    }));
  };

  const colorFields: { key: keyof typeof bp.colors; label: string }[] = [
    { key: "primary", label: "Primary" },
    { key: "secondary", label: "Secondary" },
    { key: "accent", label: "Accent" },
    { key: "background", label: "Background" },
    { key: "text", label: "Text" },
    { key: "black", label: "Black" },
    { key: "white", label: "White" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Review Blueprint</h2>
          <p className="text-brand-muted text-sm mt-1">
            Fine-tune your site settings before generation
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-brand-muted hover:text-brand-text transition-colors"
        >
          ← Back
        </button>
      </div>

      {/* Site Info */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium text-brand-muted uppercase tracking-wider">
          Site Info
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-brand-muted mb-1">Site Name</label>
            <input
              type="text"
              value={bp.name}
              onChange={(e) => setBp((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-brand-text focus:outline-none focus:border-brand-accent/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">Slug</label>
            <input
              type="text"
              value={bp.slug}
              onChange={(e) => setBp((prev) => ({ ...prev, slug: e.target.value }))}
              className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-brand-text focus:outline-none focus:border-brand-accent/50 transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-brand-muted mb-1">Description</label>
          <textarea
            value={bp.description}
            onChange={(e) => setBp((prev) => ({ ...prev, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-brand-text resize-none focus:outline-none focus:border-brand-accent/50 transition-colors"
          />
        </div>
      </section>

      {/* Colors */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium text-brand-muted uppercase tracking-wider">
          Colors
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {colorFields.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <label className="block text-xs text-brand-muted">{label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bp.colors[key]}
                  onChange={(e) => updateColors(key, e.target.value)}
                  className="w-8 h-8 rounded border border-brand-border cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={bp.colors[key]}
                  onChange={(e) => updateColors(key, e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-brand-surface border border-brand-border rounded text-xs text-brand-text font-mono focus:outline-none focus:border-brand-accent/50 transition-colors"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Typography */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium text-brand-muted uppercase tracking-wider">
          Typography
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-brand-muted mb-1">Heading Font</label>
            <input
              type="text"
              value={bp.typography.headingFont}
              onChange={(e) => updateTypography("headingFont", e.target.value)}
              className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-brand-text focus:outline-none focus:border-brand-accent/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">Body Font</label>
            <input
              type="text"
              value={bp.typography.bodyFont}
              onChange={(e) => updateTypography("bodyFont", e.target.value)}
              className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-brand-text focus:outline-none focus:border-brand-accent/50 transition-colors"
            />
          </div>
        </div>
      </section>

      {/* Pages */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-brand-muted uppercase tracking-wider">
            Pages ({bp.pages.length})
          </h3>
          <button
            onClick={addPage}
            className="text-xs text-brand-accent hover:text-brand-accent/80 transition-colors"
          >
            + Add Page
          </button>
        </div>
        <div className="space-y-2">
          {bp.pages.map((page, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 bg-brand-surface border border-brand-border rounded-lg"
            >
              <input
                type="text"
                value={page.title}
                onChange={(e) => updatePage(i, "title", e.target.value)}
                className="flex-1 bg-transparent text-sm text-brand-text focus:outline-none"
              />
              <span className="text-xs text-brand-muted font-mono">/{page.slug}</span>
              {page.isHome && (
                <span className="text-[10px] px-1.5 py-0.5 bg-brand-accent/20 text-brand-accent rounded font-medium">
                  HOME
                </span>
              )}
              {!page.isHome && (
                <button
                  onClick={() => removePage(i)}
                  className="text-brand-muted hover:text-red-400 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Custom Post Types */}
      {bp.customPostTypes.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-medium text-brand-muted uppercase tracking-wider">
            Custom Post Types ({bp.customPostTypes.length})
          </h3>
          <div className="space-y-2">
            {bp.customPostTypes.map((cpt, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3 bg-brand-surface border border-brand-border rounded-lg"
              >
                <div>
                  <span className="text-sm text-brand-text">{cpt.label}</span>
                  <span className="text-xs text-brand-muted ml-2">
                    {cpt.fields.length} fields · {cpt.posts.length} sample posts
                  </span>
                </div>
                <button
                  onClick={() => removeCpt(i)}
                  className="text-brand-muted hover:text-red-400 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Features summary */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium text-brand-muted uppercase tracking-wider">
          Features
        </h3>
        <div className="flex flex-wrap gap-2">
          {bp.hasBlog && (
            <span className="text-xs px-2.5 py-1 bg-brand-surface border border-brand-border rounded-full text-brand-text">
              Blog
            </span>
          )}
          {bp.hasContactForm && (
            <span className="text-xs px-2.5 py-1 bg-brand-surface border border-brand-border rounded-full text-brand-text">
              Contact Form
            </span>
          )}
          {bp.templates.length > 0 && (
            <span className="text-xs px-2.5 py-1 bg-brand-surface border border-brand-border rounded-full text-brand-text">
              {bp.templates.length} Templates
            </span>
          )}
          {bp.categories.length > 0 && (
            <span className="text-xs px-2.5 py-1 bg-brand-surface border border-brand-border rounded-full text-brand-text">
              {bp.categories.length} Categories
            </span>
          )}
          {bp.posts.length > 0 && (
            <span className="text-xs px-2.5 py-1 bg-brand-surface border border-brand-border rounded-full text-brand-text">
              {bp.posts.length} Sample Posts
            </span>
          )}
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 px-6 border border-brand-border text-brand-text font-medium rounded-lg hover:bg-brand-surface transition-colors"
        >
          Back to Prompt
        </button>
        <button
          onClick={() => { setIsApproving(true); onApprove(bp); }}
          disabled={isApproving}
          className="flex-1 py-3 px-6 bg-brand-accent text-brand-dark font-semibold rounded-lg hover:bg-brand-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {isApproving ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Starting Generation...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Approve &amp; Generate
            </>
          )}
        </button>
      </div>
    </div>
  );
}
