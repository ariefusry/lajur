// Live run of the 3 job fixtures against every model configured in .env.local (Groq, Cloudflare, and the dev-only
// NVIDIA/OpenRouter if set), to compare accuracy and latency. Sends only the public fixture postings.
// Run: pnpm ai:fixtures            (each model: first-try settings, then the retry settings)
//      pnpm ai:fixtures off        (first-try settings only)
import { EXTRACT_SYSTEM, ExtractedJob, normalizeJobText, verifyQuotes } from "../src/lib/ai/extract-job.ts";
import { JOB_FIXTURES } from "../src/lib/ai/job-fixtures.ts";
import type { ModelRef } from "../src/lib/ai/llm-config.ts";
import { callOnce, configuredRefs, describeError } from "./llm-call.mts";

const { refs, skipped } = configuredRefs();
for (const s of skipped) console.log(`SKIP ${s}`);
// First number in a value ("3.00 (S1), 3.25 (S2)" → 3), like eligibility/check.ts does for an S1 profile.
const num = (v?: string) => Number(v?.replace(/(\d),(\d)/g, "$1.$2").match(/\d+(\.\d+)?/)?.[0] ?? NaN);
const retryModes = process.argv[2] === "off" ? [false] : [false, true];

async function run(ref: ModelRef, retry: boolean, fx: (typeof JOB_FIXTURES)[number]) {
  const text = normalizeJobText(fx.text);
  const started = Date.now();
  const base = { model: ref.label, retry, fixture: fx.name };
  try {
    const r = await callOnce(ref, ExtractedJob, EXTRACT_SYSTEM, text, retry);
    if (!r.data) throw Object.assign(new Error(r.schemaError ?? "invalid"), { name: "InvalidOutput" });
    const raw = r.data;
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
      oneEach: ["MIN_GPA", "MAX_AGE", "MIN_DEGREE"].every(
        (t) => v.requirements.filter((r) => r.type === t).length <= 1,
      ),
      ageRef: e.ageReferenceDate === null || req("MAX_AGE")?.ageReferenceDate === e.ageReferenceDate,
      skills: e.skills.every((re) => v.skills.some((s) => re.test(s.name))),
    };
    return {
      ...base,
      ms: r.ms,
      tokens: `${r.tokensIn ?? "?"}+${r.tokensOut ?? "?"}`,
      score: `${Object.values(checks).filter(Boolean).length}/${Object.keys(checks).length}`,
      failed:
        Object.entries(checks)
          .filter(([, ok]) => !ok)
          .map(([k]) => k)
          .join(",") || "-",
      quotesKept: `${v.skills.length + v.requirements.length}/${raw.skills.length + raw.requirements.length}`,
    };
  } catch (error) {
    return { ...base, ms: Date.now() - started, score: "ERROR", failed: describeError(error) };
  }
}

// Sequential on purpose: free endpoints reject bursts.
const results = [];
for (const ref of refs)
  for (const retry of retryModes)
    for (const fx of JOB_FIXTURES) {
      const r = await run(ref, retry, fx);
      console.log(JSON.stringify(r));
      results.push(r);
    }
console.table(results);
