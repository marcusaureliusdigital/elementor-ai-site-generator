"use client";

import { useEffect, useState, useRef } from "react";
import type { FileState, GenerationMode } from "@/lib/types";

interface GenerationProgressProps {
  jobId: string;
  mode?: GenerationMode;
  onComplete: () => void;
}

interface StatusResponse {
  status: "pending" | "generating" | "complete" | "error";
  progress: number;
  files: Record<string, FileState>;
  error?: string;
}

const STATUS_ICONS: Record<string, string> = {
  pending: "○",
  generating: "◎",
  done: "●",
  error: "✕",
};

export function GenerationProgress({ jobId, mode = "website", onComplete }: GenerationProgressProps) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/status?jobId=${jobId}`);
        if (!res.ok) return;
        const data: StatusResponse = await res.json();
        setStatus(data);

        // Build log entries from file states
        const entries: string[] = [];
        for (const file of Object.values(data.files)) {
          if (file.status === "generating") {
            entries.push(`▸ Generating ${file.label}...`);
          } else if (file.status === "done") {
            entries.push(`✓ ${file.label}`);
          } else if (file.status === "error") {
            entries.push(`✕ ${file.label}: ${file.error || "Unknown error"}`);
          }
        }
        setLogs(entries);

        if (data.status === "complete") {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onComplete();
        } else if (data.status === "error") {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // Silently retry
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId, onComplete]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const progress = status?.progress ?? 0;
  const fileEntries = status?.files ? Object.entries(status.files) : [];
  const isError = status?.status === "error";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-bold tracking-tight">
          {isError ? (
            <span className="text-red-400">Generation Failed</span>
          ) : (
            <>
              Generating your{" "}
              <span className="text-brand-accent">
                {mode === "landing-page" ? "Landing Page" : "Site Kit"}
              </span>
            </>
          )}
        </h2>
        <p className="text-brand-muted text-sm">
          {isError
            ? status?.error || "An unexpected error occurred."
            : mode === "landing-page"
            ? "Building sections and content..."
            : "Building templates, pages, and content files..."}
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-brand-muted">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-brand-surface rounded-full overflow-hidden border border-brand-border">
          <div
            className="h-full progress-shimmer rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* File list */}
      <div className="space-y-1.5">
        {fileEntries.map(([key, file]) => (
          <div
            key={key}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
              file.status === "generating"
                ? "bg-brand-accent/5 border border-brand-accent/20"
                : file.status === "done"
                ? "bg-brand-surface/50"
                : file.status === "error"
                ? "bg-red-500/5 border border-red-500/20"
                : "opacity-40"
            }`}
          >
            <span
              className={`text-xs font-mono ${
                file.status === "generating"
                  ? "text-brand-accent animate-pulse"
                  : file.status === "done"
                  ? "text-green-400"
                  : file.status === "error"
                  ? "text-red-400"
                  : "text-brand-muted"
              }`}
            >
              {STATUS_ICONS[file.status]}
            </span>
            <span
              className={
                file.status === "generating"
                  ? "text-brand-text"
                  : file.status === "done"
                  ? "text-brand-muted"
                  : file.status === "error"
                  ? "text-red-400"
                  : "text-brand-muted"
              }
            >
              {file.label}
            </span>
            {file.status === "generating" && (
              <svg
                className="ml-auto animate-spin h-3.5 w-3.5 text-brand-accent"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {file.status === "error" && (
              <span className="ml-auto text-xs text-red-400">{file.error}</span>
            )}
          </div>
        ))}
      </div>

      {/* Terminal log */}
      {logs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-brand-muted uppercase tracking-wider">
            Build Log
          </p>
          <div
            ref={terminalRef}
            className="h-36 overflow-y-auto bg-brand-dark border border-brand-border rounded-lg px-4 py-3"
          >
            {logs.map((log, i) => (
              <div key={i} className="terminal-text text-brand-muted">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
