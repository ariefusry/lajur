// Live run of the email-update fixtures against every model configured in .env.local, scored on the plan Lajur
// would propose. Each email is redacted first, as in the app; the fixtures hold only made-up personal data.
// Run: pnpm ai:email                 (all fixtures)
//      pnpm ai:email apple --verbose (fixtures whose name contains "apple", printing raw and verified answers)
import { redactPII } from "../src/lib/ai/redact.ts";
import { EMAIL_FIXTURES } from "../src/lib/email-update/fixtures.ts";
import { matchApplications, planEmailUpdate, summarizePlan } from "../src/lib/email-update/plan.ts";
import {
  EMAIL_SYSTEM,
  EmailReading,
  normalizeEmailText,
  rehydrateReading,
  verifyReading,
} from "../src/lib/email-update/reading.ts";
import type { ModelRef } from "../src/lib/ai/llm-config.ts";
import { STAGE_TEMPLATES } from "../src/lib/stage-templates.ts";
import { callOnce, configuredRefs, describeError } from "./llm-call.mts";

const verbose = process.argv.includes("--verbose");
const filter = process.argv.slice(2).find((a) => !a.startsWith("--"));
const fixtures = EMAIL_FIXTURES.filter((f) => !filter || f.name.toLowerCase().includes(filter.toLowerCase()));

const { refs, skipped } = configuredRefs();
for (const s of skipped) console.log(`SKIP ${s}`);

const stages = STAGE_TEMPLATES.BUMN.stages.map((s, order) => ({ ...s, order, id: s.name }));
// The company the user would have typed for the application (or should get prefilled, for a new one).
const COMPANY: Record<string, string> = {
  Apple: "Apple Developer Academy",
  Peepl: "Peepl",
  ISS: "ISS Indonesia",
  Astra: "PT Global Service Indonesia",
  BNI: "BNI",
};
const companyOf = (f: (typeof EMAIL_FIXTURES)[number]) => COMPANY[f.name.split(" ")[0]];
// An application in Administrasi, except for the "application received" email, which is about a new one.
const appFor = (f: (typeof EMAIL_FIXTURES)[number]) =>
  f.expect.kind === "APPLICATION_RECEIVED"
    ? null
    : {
        currentStageId: "Administrasi",
        history: [
          { stageId: "Wishlist", result: null },
          { stageId: "Administrasi", result: null },
        ],
        events: [],
      };

async function run(ref: ModelRef, f: (typeof EMAIL_FIXTURES)[number]) {
  const redacted = redactPII(normalizeEmailText(f.text), { name: f.userName });
  const base = { model: ref.label, fixture: f.name.split(" - ")[0] };
  const started = Date.now();
  try {
    // Like provider.ts: one retry with the retry settings when the answer fails the schema.
    let r = await callOnce(ref, EmailReading, EMAIL_SYSTEM, redacted.text);
    if (!r.data) r = await callOnce(ref, EmailReading, EMAIL_SYSTEM, redacted.text, true);
    if (!r.data) throw Object.assign(new Error(r.schemaError ?? "invalid"), { name: "InvalidOutput" });
    const reading = rehydrateReading(verifyReading(r.data, redacted.text), redacted.map);
    if (verbose) console.log(JSON.stringify({ ...base, raw: r.data, verified: reading }, null, 2));
    const got = summarizePlan(reading, planEmailUpdate(reading, { stages, app: appFor(f) }), stages);
    const e = f.expect;
    const checks = {
      company: matchApplications(reading.company, [{ id: "x", company: companyOf(f) }]).length > 0,
      kind: got.kind === e.kind,
      move: got.move === e.move,
      events: JSON.stringify(got.events) === JSON.stringify(e.events),
      fail: got.fail === e.fail,
      notes: got.notes === e.notes,
    };
    return {
      ...base,
      ms: Date.now() - started,
      tokens: `${r.tokensIn ?? "?"}+${r.tokensOut ?? "?"}`,
      score: `${Object.values(checks).filter(Boolean).length}/${Object.keys(checks).length}`,
      failed:
        Object.entries(checks)
          .filter(([, ok]) => !ok)
          .map(([k]) => k)
          .join(",") || "-",
      eventsKept: `${reading.events.length}/${r.data.events.length}`,
    };
  } catch (error) {
    // Groq's body holds the rejected answer (failed_generation), never the prompt or the key.
    const body = (error as { responseBody?: string }).responseBody;
    if (verbose) console.log(JSON.stringify({ ...base, error: body }));
    // Groq's strict schema check names the offending field; that is all the table needs.
    const field = body?.match(/jsonschema: '([^']*)'/)?.[1];
    const failed = field ? `schema rejected ${field}` : describeError(error);
    return { ...base, ms: Date.now() - started, score: "ERROR", failed };
  }
}

// Sequential on purpose: free endpoints reject bursts.
const results = [];
for (const ref of refs)
  for (const f of fixtures) {
    const r = await run(ref, f);
    if (!verbose) console.log(JSON.stringify(r));
    results.push(r);
  }
console.table(results);
