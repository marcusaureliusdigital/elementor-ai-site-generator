/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { GenerationMode } from "@/lib/types";

const MODEL_OPTIONS = [
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
];

const WEBSITE_PROMPTS = [
  "A dark-mode photography portfolio with a 'Destinations' CPT, 5 pages (Home, About, Destinations, Photography, Contact), and a blog section",
  "A modern SaaS landing page with pricing table, features grid, testimonials carousel, and a contact form. Blue and white color scheme",
  "A personal travel blog with custom post type for 'Recipes', warm earthy tones, and a newsletter signup section",
  "A minimalist architecture studio website with project case studies, team page, and a services section. Black and white with gold accents",
];

const LANDING_PAGE_PROMPTS = [
  "A SaaS product landing page for a project management tool with hero, features, pricing tiers, testimonials, and a free trial CTA",
  "A real estate landing page for a luxury condo development with hero image, amenities, floor plans gallery, and a contact form for inquiries",
  "A newsletter signup landing page for a weekly tech digest with social proof, benefits, sample content preview, and email capture form",
  "A consulting firm landing page with hero, services overview, case study stats, client testimonials, and a booking CTA",
];

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,image/gif,.html,.htm,.css,.json,.zip,.txt,.md";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.type.startsWith("image/")) return "IMG";
  if (ext === "html" || ext === "htm") return "HTML";
  if (ext === "css") return "CSS";
  if (ext === "json") return "JSON";
  if (ext === "zip") return "ZIP";
  return "TXT";
}

interface PromptInputProps {
  onSubmit: (prompt: string, modelId: string, mode: GenerationMode, files: File[]) => void;
  isLoading: boolean;
}

export function PromptInput({ onSubmit, isLoading }: PromptInputProps) {
  const [value, setValue] = useState("");
  const [modelId, setModelId] = useState("claude-opus-4-6");
  const [mode, setMode] = useState<GenerationMode>("website");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !isLoading) {
      onSubmit(value.trim(), modelId, mode, files);
    }
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const incoming = Array.from(newFiles);
    setFiles((prev) => {
      const combined = [...prev, ...incoming];
      // Deduplicate by name + size
      const seen = new Set<string>();
      return combined.filter((f) => {
        const key = `${f.name}:${f.size}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  // Memoize blob URLs for image previews — only recompute when files change
  const fileUrls = useMemo(() => {
    return files.map((f) =>
      f.type.startsWith("image/") ? URL.createObjectURL(f) : null
    );
  }, [files]);

  // Revoke old blob URLs on cleanup to prevent memory leaks
  useEffect(() => {
    return () => {
      fileUrls.forEach((url) => { if (url) URL.revokeObjectURL(url); });
    };
  }, [fileUrls]);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const examples = mode === "landing-page" ? LANDING_PAGE_PROMPTS : WEBSITE_PROMPTS;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold tracking-tight">
          Describe your <span className="text-brand-accent">{mode === "landing-page" ? "landing page" : "website"}</span>
        </h2>
        <p className="text-brand-muted max-w-lg mx-auto">
          {mode === "landing-page"
            ? "Tell us about your landing page. We'll generate a complete Elementor template JSON ready to import."
            : "Tell us what kind of website you want to build. We'll generate a complete Elementor Pro Site Kit ready to import into WordPress."}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex justify-center">
        <div className="inline-flex bg-brand-surface border border-brand-border rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode("website")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              mode === "website"
                ? "bg-brand-accent text-brand-dark shadow-sm"
                : "text-brand-muted hover:text-brand-text"
            }`}
          >
            Full Website
          </button>
          <button
            type="button"
            onClick={() => setMode("landing-page")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              mode === "landing-page"
                ? "bg-brand-accent text-brand-dark shadow-sm"
                : "text-brand-muted hover:text-brand-text"
            }`}
          >
            Landing Page
          </button>
        </div>
      </div>

      {/* Prompt form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Model selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-brand-muted uppercase tracking-wider whitespace-nowrap">
            AI Model
          </label>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-brand-text focus:outline-none focus:border-brand-accent/50 transition-colors cursor-pointer disabled:opacity-40"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              mode === "landing-page"
                ? "e.g. A SaaS landing page for a project management tool with pricing, testimonials, and a free trial CTA..."
                : "e.g. A photography portfolio with a dark theme, custom post type for Destinations, 5 pages..."
            }
            className="w-full h-40 px-4 py-3 bg-brand-surface border border-brand-border rounded-lg text-brand-text placeholder:text-brand-muted/50 resize-none focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/25 transition-colors"
            disabled={isLoading}
          />
          <div className="absolute bottom-3 right-3 text-xs text-brand-muted">
            {value.length} chars
          </div>
        </div>

        {/* File upload drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-brand-accent bg-brand-accent/5"
              : "border-brand-border/60 hover:border-brand-border hover:bg-brand-surface/50"
          } ${isLoading ? "opacity-40 pointer-events-none" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="flex flex-col items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-muted">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div>
              <span className="text-sm text-brand-muted">
                Drop reference images or website files here, or{" "}
                <span className="text-brand-accent">browse</span>
              </span>
            </div>
            <span className="text-xs text-brand-muted/60">
              Images (PNG, JPG, WebP) &middot; HTML, CSS, JSON, ZIP, TXT &middot; Max 4 images, 10 files
            </span>
          </div>
        </div>

        {/* File preview list */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-brand-muted">
                {files.length} file{files.length !== 1 ? "s" : ""} ({formatFileSize(totalSize)})
              </span>
              <button
                type="button"
                onClick={() => setFiles([])}
                className="text-xs text-brand-muted hover:text-brand-text transition-colors"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {files.map((file, i) => {
                const isImage = file.type.startsWith("image/");
                return (
                  <div
                    key={`${file.name}-${file.size}-${i}`}
                    className="group relative flex items-center gap-2 px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm"
                  >
                    {isImage && fileUrls[i] ? (
                      <img
                        src={fileUrls[i]}
                        alt={file.name}
                        className="w-8 h-8 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-brand-border/30 text-[10px] font-bold text-brand-muted flex-shrink-0">
                        {getFileTypeLabel(file)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-brand-text truncate max-w-[140px]">{file.name}</p>
                      <p className="text-[10px] text-brand-muted">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(i);
                      }}
                      className="ml-1 text-brand-muted hover:text-brand-text transition-colors flex-shrink-0"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={!value.trim() || isLoading}
          className="w-full py-3 px-6 bg-brand-accent text-brand-dark font-semibold rounded-lg hover:bg-brand-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating Blueprint...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              Generate Blueprint
            </>
          )}
        </button>
      </form>

      {/* Example prompts */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-brand-muted uppercase tracking-wider">Try an example</p>
        <div className="grid gap-2">
          {examples.map((example, i) => (
            <button
              key={i}
              onClick={() => setValue(example)}
              disabled={isLoading}
              className="text-left px-4 py-3 bg-brand-surface/50 border border-brand-border/50 rounded-lg text-sm text-brand-muted hover:text-brand-text hover:border-brand-border transition-colors disabled:opacity-40"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
