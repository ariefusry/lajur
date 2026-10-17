// Live run of the 3 job fixtures with the app's LLM setup (mirrors src/lib/ai/provider.ts, which can't be
// imported here: it's server-only and uses path aliases). Sends only the public fixture postings.
// Run: pnpm ai:fixtures            (LLM_MODEL and LLM_FALLBACK_MODEL, each with reasoning off then on)
//      pnpm ai:fixtures off        (reasoning off only)
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { z } from "zod";
import { EXTRACT_SYSTEM, ExtractedJob, normalizeJobText, verifyQuotes } from "../src/lib/ai/extract-job.ts";
import { JOB_FIXTURES } from "../src/lib/ai/job-fixtures.ts";
import { extractJsonObject } from "../src/lib/ai/json-text.ts";

const PROVIDERS = {
  nvidia: {
    client: createOpenAICompatible({ name: "nvidia", baseURL: process.env.NVIDIA_BASE_URL!, apiKey: process.env.NVIDIA_API_KEY }),
    thinking: (on: boolean) => ({ chat_template_kwargs: { enable_thinking: on } }),
  },
  openrouter: {
    client: createOpenAICompatible({ name: "openrouter", baseURL: "https://openrouter.ai/api/v1", apiKey: process.env.OPENROUTER_API_KEY }),
    thinking: (on: boolean) => ({ reasoning: { enabled: on } }),
  },
};
type ProviderName = keyof typeof PROVIDERS;

const refs = [process.env.LLM_MODEL, process.env.LLM_FALLBACK_MODEL].filter(Boolean).map((raw) => {
  const i = raw!.indexOf(":");
  return { provider: raw!.slice(0, i) as ProviderName, model: raw!.slice(i + 1), label: raw! };
});
// First number in a value ("3.00 (S1), 3.25 (S2)" → 3), like eligibility/check.ts does for an S1 profile.
const num = (v?: string) => Number(v?.replace(/(\d),(\d)/g, "$1.$2").match(/\d+(\.\d+)?/)?.[0] ?? NaN);
const thinkingModes = process.argv[2] === "off" ? [false] : [false, true];
const schemaPrompt = `\n\nBalas HANYA dengan satu objek JSON yang valid terhadap JSON Schema berikut, tanpa markdown dan tanpa teks lain:\n${JSON.stringify(z.toJSONSchema(ExtractedJob))}`;

async function run(ref: (typeof refs)[number], thinking: boolean, fx: (typeof JOB_FIXTURES)[number]) {
  const text = normalizeJobText(fx.text);
  const p = PROVIDERS[ref.provider];
  const started = Date.now();
  const base = { model: ref.label, thinking, fixture: fx.name };
  try {
    const system = EXTRACT_SYSTEM + schemaPrompt;
    let streamError: unknown;
    const result = streamText({
      model: p.client(ref.model),
      system: ref.provider === "nvidia" && !thinking ? `/no_think\n${system}` : system,
      prompt: text,
      temperature: 0,
      maxOutputTokens: 4000,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(60_000),
      providerOptions: { [ref.provider]: p.thinking(thinking) },
      onError: ({ error }) => {
        streamError = error;
      },
    });
    let text_ = "";
    for await (const delta of result.textStream) text_ += delta;
    if (streamError) throw streamError;
    const checked = ExtractedJob.safeParse(JSON.parse(extractJsonObject(text_) ?? "null"));
    if (!checked.success) throw Object.assign(new Error(z.prettifyError(checked.error).slice(0, 80)), { name: "InvalidOutput" });
    const raw = checked.data;
    const v = verifyQuotes(raw, text);
    const e = fx.expected;
    const types = new Set(v.requirements.map((r) => r.type));
    const req = (t: string) => v.requirements.find((r) => r.type === t);
    const checks = {
      company: e.company.test(v.company ?? ""),
      position: e.position.test(v.position ?? ""),
      deadline: v.deadline === e.deadline,
      types: e.requirementTypes.every((t) => types.has(t)),
      gpa: e.gpa === null ? !req("MIN_GPA") : num(req("MIN_GPA")?.value) === Number(e.gpa),
      maxAge: e.maxAge === null ? !req("MAX_AGE") : num(req("MAX_AGE")?.value) === Number(e.maxAge),
      oneEach: ["MIN_GPA", "MAX_AGE", "MIN_DEGREE"].every((t) => v.requirements.filter((r) => r.type === t).length <= 1),
      ageRef: e.ageReferenceDate === null || req("MAX_AGE")?.ageReferenceDate === e.ageReferenceDate,
      skills: e.skills.every((re) => v.skills.some((s) => re.test(s.name))),
    };
    return {
      ...base, ms: Date.now() - started,
      score: `${Object.values(checks).filter(Boolean).length}/${Object.keys(checks).length}`,
      failed: Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k).join(",") || "-",
      quotesKept: `${v.skills.length + v.requirements.length}/${raw.skills.length + raw.requirements.length}`,
    };
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    return { ...base, ms: Date.now() - started, score: "ERROR", failed: `${err.name}${err.statusCode ? ` ${err.statusCode}` : ""}: ${err.message.slice(0, 80)}` };
  }
}

// Sequential on purpose: free endpoints reject bursts.
const results = [];
for (const ref of refs) for (const thinking of thinkingModes) for (const fx of JOB_FIXTURES) {
  const r = await run(ref, thinking, fx);
  console.log(JSON.stringify(r));
  results.push(r);
}
console.table(results);
