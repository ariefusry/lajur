import { z } from "zod";
import {
  EligibilityStatus,
  EventType,
  JobSource,
  RequirementType,
  StageResult,
} from "@/generated/prisma/enums";
import { StoredCvTweaks } from "@/lib/ai/cv-tweaks";

/**
 * Everything needed to bring a deleted application back ("Urungkan"). It travels through the client,
 * so `restoreApplication` re-validates it and takes the owner from the session, never from this object.
 */
export const applicationSnapshotSchema = z.object({
  id: z.string().min(1).max(64),
  resumeId: z.string().nullable(),
  currentStageId: z.string(),
  company: z.string().max(300),
  position: z.string().max(300),
  source: z.enum(JobSource),
  url: z.string().nullable(),
  jobPostingText: z.string().nullable(),
  location: z.string().nullable(),
  deadline: z.date().nullable(),
  expectedSalary: z.number().int().nullable(),
  notes: z.string().nullable(),
  appliedAt: z.date().nullable(),
  nextActionAt: z.date().nullable().default(null),
  lastFollowUpAt: z.date().nullable().default(null),
  followUpRemindedAt: z.date().nullable().default(null),
  cvTweaks: StoredCvTweaks.default([]),
  createdAt: z.date(),
  history: z.array(
    z.object({
      stageId: z.string(),
      enteredAt: z.date(),
      result: z.enum(StageResult).nullable(),
      notes: z.string().nullable(),
    }),
  ),
  events: z.array(
    z.object({
      type: z.enum(EventType),
      startsAt: z.date(),
      locationOrUrl: z.string().nullable(),
      remindedH3At: z.date().nullable(),
      remindedH1At: z.date().nullable(),
    }),
  ),
  requirements: z.array(
    z.object({
      type: z.enum(RequirementType),
      value: z.string(),
      sourceQuote: z.string(),
      status: z.enum(EligibilityStatus),
      reason: z.string().nullable(),
      editedByUser: z.boolean(),
    }),
  ),
  skillGaps: z.array(
    z.object({
      skill: z.string(),
      inResume: z.boolean(),
      suggestion: z.string().nullable(),
      sourceQuote: z.string().nullable(),
    }),
  ),
});

export type ApplicationSnapshot = z.infer<typeof applicationSnapshotSchema>;
