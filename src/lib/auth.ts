import "server-only";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { templateStageRows } from "@/lib/stage-templates";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The adapter is typed against the legacy @prisma/client entry; our client is generated to src/generated.
  adapter: PrismaAdapter(db as unknown as Parameters<typeof PrismaAdapter>[0]),
  providers: [Google],
  session: { strategy: "database" },
  pages: { signIn: "/login" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    // Default pipeline on first login; user can switch template in Settings.
    async createUser({ user }) {
      if (user.id) await db.stage.createMany({ data: templateStageRows("BUMN", user.id) });
    },
  },
});

/** Use in every server action, route and page that touches user data. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null };
}
