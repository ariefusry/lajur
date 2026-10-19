// No "@/" imports: scripts/ load this through plain Node, and a client component re-plans with it.
import type { EventType, StageKind, StageResult } from "../../generated/prisma/enums.ts";
import { formatDate } from "../dates.ts";
import { fold } from "../text.ts";
import { parseWib, type EmailReading } from "./reading.ts";

/** Lowercase, without PT, Tbk, (…) and punctuation. */
export function normalizeCompany(name: string) {
  return fold(
    name
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\b(pt|tbk|persero)\b/g, " "),
  );
}

/** Ids of the applications whose company matches, best first: identical, then one name containing the other. */
export function matchApplications(company: string | null, apps: { id: string; company: string }[]): string[] {
  const want = company ? normalizeCompany(company) : "";
  const score = (other: string) => {
    const have = normalizeCompany(other);
    if (Math.min(want.length, have.length) < 3) return 0;
    if (have === want) return 2;
    // Whole words only, so "indo" does not match "indosat".
    return ` ${have} `.includes(` ${want} `) || ` ${want} `.includes(` ${have} `) ? 1 : 0;
  };
  return apps
    .map((a) => ({ id: a.id, score: score(a.company) }))
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((a) => a.id);
}

export type Change =
  | { id: string; kind: "move"; stageId: string; quote: string }
  // ISO strings.
  | {
      id: string;
      kind: "event";
      type: EventType;
      startsAt: string;
      opensAt: string | null;
      locationOrUrl: string | null;
      quote: string;
    }
  // Marks this stage's step FAILED, adding the step if it is missing.
  | { id: string; kind: "fail"; stageId: string; quote: string }
  | { id: string; kind: "notes"; text: string };

type Stage = { id: string; name: string; order: number; kind: StageKind };
type PlanContext = {
  stages: Stage[];
  app: {
    currentStageId: string;
    history: { stageId: string; result: StageResult | null }[];
    events: { type: EventType; startsAt: Date; opensAt: Date | null }[];
  } | null;
};

type StageGroup = "PSYCHOTEST" | "LGD" | "INTERVIEW_USER" | "INTERVIEW_HR" | "INTERVIEW" | "MCU" | "ONLINE_TEST";

// Checked top to bottom against the stage name in the email, so "Psikotes Online" is a psychotest and "User
// Interview" is not a plain interview. Each group then picks the first of the user's stages matching one of its
// patterns, tried in order. Loose on purpose: emails misspell stages ("Online Assesment").
const STAGE_SYNONYMS: { group: StageGroup; email: RegExp; stage: RegExp[] }[] = [
  { group: "PSYCHOTEST", email: /psiko|psycho/, stage: [/psiko|psycho/] },
  { group: "LGD", email: /lgd|group discussion|diskusi/, stage: [/lgd|group discussion|diskusi/] },
  {
    group: "INTERVIEW_USER",
    email: /(interview|wawancara) user|user (interview|wawancara)/,
    stage: [/(interview|wawancara) user|user (interview|wawancara)/, /interview|wawancara/],
  },
  {
    group: "INTERVIEW_HR",
    email: /(interview|wawancara) hr|hr (interview|wawancara)/,
    stage: [/(interview|wawancara) hr|hr (interview|wawancara)/, /interview|wawancara/],
  },
  { group: "INTERVIEW", email: /interview|wawancara/, stage: [/interview|wawancara/] },
  { group: "MCU", email: /mcu|medical|kesehatan/, stage: [/mcu|medical|kesehatan/] },
  {
    group: "ONLINE_TEST",
    email: /online|tpa|asses|\btes\b|\btest\b/,
    stage: [/online|tpa/, /\btes\b|\btest\b/],
  },
];

const EVENT_GROUP: Partial<Record<EventType, StageGroup>> = {
  ONLINE_TEST: "ONLINE_TEST",
  PSYCHOTEST: "PSYCHOTEST",
  LGD: "LGD",
  INTERVIEW_HR: "INTERVIEW_HR",
  INTERVIEW_USER: "INTERVIEW_USER",
  MCU: "MCU",
};

function stageOfGroup(group: StageGroup | undefined, stages: Stage[]) {
  const patterns = STAGE_SYNONYMS.find((s) => s.group === group)?.stage ?? [];
  for (const p of patterns) {
    const hit = stages.find((s) => p.test(fold(s.name)));
    if (hit) return hit;
  }
  return undefined;
}

const stageOfName = (name: string | null, stages: Stage[]) =>
  name ? stageOfGroup(STAGE_SYNONYMS.find((s) => s.email.test(fold(name)))?.group, stages) : undefined;

function stageOfKind(r: EmailReading, stages: Stage[]) {
  switch (r.kind) {
    case "TEST_INVITE":
      return stageOfGroup(r.events[0] && EVENT_GROUP[r.events[0].type], stages);
    case "INTERVIEW":
      return stageOfGroup("INTERVIEW", stages);
    case "MCU":
      return stageOfGroup("MCU", stages);
    case "OFFER":
      return stages.find((s) => s.kind === "OFFER");
    case "REJECTION":
      return stages.find((s) => s.kind === "REJECTED");
    default:
      return undefined;
  }
}

/** The changes an email proposes for an application (or for a new one when `app` is null); nothing is saved. */
export function planEmailUpdate(reading: EmailReading, ctx: PlanContext): Change[] {
  const stages = [...ctx.stages].sort((a, b) => a.order - b.order);
  const { app } = ctx;
  const rejection = reading.kind === "REJECTION";
  const changes: Change[] = [];

  const target = rejection
    ? stageOfKind(reading, stages)
    : (stageOfName(reading.stageName, stages) ?? stageOfKind(reading, stages));
  if (target && target.id !== app?.currentStageId) {
    changes.push({ id: "move", kind: "move", stageId: target.id, quote: reading.kindQuote });
  }

  if (rejection) {
    const named = stageOfName(reading.stageName, stages);
    if (named) {
      changes.push({ id: "fail", kind: "fail", stageId: named.id, quote: reading.stageName! });
    } else {
      const rejected = new Set(stages.filter((s) => s.kind === "REJECTED").map((s) => s.id));
      const last = app?.history.findLast((h) => !rejected.has(h.stageId));
      if (last && !last.result) {
        changes.push({ id: "fail", kind: "fail", stageId: last.stageId, quote: reading.kindQuote });
      }
    }
  } else {
    reading.events.forEach((e, i) => {
      const startsAt = parseWib(e.closesAt);
      if (!startsAt) return;
      const opensAt = (e.opensAt && parseWib(e.opensAt)?.toISOString()) || null;
      const known = app?.events.some(
        (x) =>
          x.type === e.type &&
          x.startsAt.getTime() === startsAt.getTime() &&
          (x.opensAt?.toISOString() ?? null) === opensAt,
      );
      if (known) return;
      changes.push({
        id: `event-${i}`,
        kind: "event",
        type: e.type,
        startsAt: startsAt.toISOString(),
        opensAt,
        locationOrUrl: reading.sourceUrl,
        quote: e.quote,
      });
    });
  }

  if (reading.notes.length > 0) {
    changes.push({ id: "notes", kind: "notes", text: reading.notes.map((n) => "- " + n).join("\n") });
  }
  return changes;
}

export type PlanSummary = {
  kind: EmailReading["kind"];
  move: string | null; // stage name
  events: { type: EventType; startsAt: string; opensAt: string | null }[];
  fail: string | null; // stage name
  notes: boolean;
};

/** A plan in the compact shape of `EmailFixture.expect`, so live answers can be scored. */
export function summarizePlan(reading: EmailReading, changes: Change[], stages: Stage[]): PlanSummary {
  const name = (id: string | undefined) => stages.find((s) => s.id === id)?.name ?? null;
  return {
    kind: reading.kind,
    move: name(changes.find((c) => c.kind === "move")?.stageId),
    events: changes.flatMap((c) =>
      c.kind === "event" ? [{ type: c.type, startsAt: c.startsAt, opensAt: c.opensAt }] : [],
    ),
    fail: name(changes.find((c) => c.kind === "fail")?.stageId),
    notes: changes.some((c) => c.kind === "notes"),
  };
}

/** New notes go below the existing ones, under today's date. */
export function appendNotes(existing: string | null, text: string, today: Date): string {
  const entry = `${formatDate(today)}\n${text}`;
  return existing?.trim() ? `${existing.trimEnd()}\n\n${entry}` : entry;
}
