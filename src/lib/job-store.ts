import type { JobState, FileState, JobStatus, SiteBlueprint, GenerationMode, LandingPageBlueprint } from "./types";

/**
 * In-memory job store for MVP.
 * Auto-cleans jobs older than 1 hour.
 *
 * Uses globalThis to survive Next.js module re-evaluation in dev mode.
 * Without this, /api/generate and /api/status get separate Map instances.
 */

const globalKey = "__elementor_job_store__" as const;

function getJobsMap(): Map<string, JobState> {
  if (!(globalThis as any)[globalKey]) {
    (globalThis as any)[globalKey] = new Map<string, JobState>();
  }
  return (globalThis as any)[globalKey];
}

const jobs = getJobsMap();

const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_AGE = 60 * 60 * 1000; // 1 hour

// Periodic cleanup
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (now - job.createdAt > MAX_AGE) {
        jobs.delete(id);
      }
    }
  }, CLEANUP_INTERVAL);
}

export function createJob(
  id: string,
  blueprint: SiteBlueprint,
  mode: GenerationMode = "website",
  landingBlueprint?: LandingPageBlueprint
): JobState {
  const job: JobState = {
    id,
    mode,
    blueprint,
    landingBlueprint,
    status: "pending",
    files: {},
    progress: 0,
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): JobState | undefined {
  return jobs.get(id);
}

export function setJobStatus(id: string, status: JobStatus, error?: string) {
  const job = jobs.get(id);
  if (job) {
    job.status = status;
    if (error) job.error = error;
  }
}

export function registerFile(id: string, fileKey: string, label: string) {
  const job = jobs.get(id);
  if (job) {
    job.files[fileKey] = { status: "pending", label };
  }
}

export function updateFile(
  id: string,
  fileKey: string,
  update: Partial<FileState>
) {
  const job = jobs.get(id);
  if (job && job.files[fileKey]) {
    Object.assign(job.files[fileKey], update);
    recalcProgress(job);
  }
}

export function setFileContent(id: string, fileKey: string, content: string) {
  updateFile(id, fileKey, { status: "done", content });
}

export function setFileError(id: string, fileKey: string, error: string) {
  updateFile(id, fileKey, { status: "error", error });
}

export function setFileGenerating(id: string, fileKey: string) {
  updateFile(id, fileKey, { status: "generating" });
}

function recalcProgress(job: JobState) {
  const entries = Object.values(job.files);
  if (entries.length === 0) return;
  const done = entries.filter((f) => f.status === "done").length;
  job.progress = (done / entries.length) * 100;
}

/**
 * Collect all generated file contents from a completed job.
 */
export function collectFiles(id: string): Record<string, string> | null {
  const job = jobs.get(id);
  if (!job) return null;

  const result: Record<string, string> = {};
  for (const [key, file] of Object.entries(job.files)) {
    if (file.content) {
      result[key] = file.content;
    }
  }
  return result;
}
