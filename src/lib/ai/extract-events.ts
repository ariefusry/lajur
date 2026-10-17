import type { DeepPartial } from "ai";
import type { ExtractedJob } from "@/lib/ai/extract-job";

/** NDJSON events streamed by POST /api/ai/extract. */
export type ExtractEvent =
  | { type: "status"; status: "fetching" | "reading" | "retrying" | "fallback" | "verifying" }
  | { type: "partial"; job: DeepPartial<ExtractedJob> }
  | { type: "result"; job: ExtractedJob; text: string; cached: boolean }
  | { type: "error"; status: number; error: string };
