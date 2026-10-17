import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  auth: false,
  buckets: {
    // "private" is the default; use "public_read" for anonymous reads
    resumes: { access: "private" }, // CV files; must stay private (CLAUDE.md 7.2)
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // Long-lived branches: "dev" (local development) and "ci" (GitHub Actions E2E) never expire.
      if (branch.name === "dev" || branch.name === "ci") return {};
      // Other new branches (experiments): auto-expire
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
