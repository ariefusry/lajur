// No "@/" imports: scripts/ and prisma/seed.mts load modules that use this through plain Node.

/** Collapses runs of whitespace (line breaks included) into single spaces. */
export const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** `squash`, case-insensitive. */
export const fold = (s: string) => squash(s).toLowerCase();

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
