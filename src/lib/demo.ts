export const DEMO_EMAIL = "demo@lamarin.local";
export const isDemoEmail = (email: string | null | undefined) => email === DEMO_EMAIL;

export const DEMO_READ_ONLY_MESSAGE =
  "Mode demo hanya bisa dilihat. Masuk dengan Google untuk mencatat lamaranmu sendiri.";

/** The demo account is view-only where DEMO_READ_ONLY=true (production); writable in CI/E2E and locally. */
export function isReadOnly(user: { email: string | null }) {
  return isDemoEmail(user.email) && process.env.DEMO_READ_ONLY === "true";
}

export const demoLoginEnabled = () => process.env.DEMO_LOGIN_ENABLED === "true";
