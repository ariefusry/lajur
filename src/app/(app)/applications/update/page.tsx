import { EmailUpdate } from "@/components/email-update/email-update";
import { LamaranSubNav } from "@/components/nav-links";
import { aiEnabled } from "@/lib/ai/provider";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isReadOnly } from "@/lib/demo";

export const metadata = { title: "Update dari email · Lajur" };

export default async function EmailUpdatePage() {
  const user = await requireUser();
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { aiConsentAt: true, emailAiNoticeAt: true },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <LamaranSubNav />
      <h1 className="text-2xl font-semibold tracking-tight">Update dari email</h1>
      <EmailUpdate
        consentedAt={row?.aiConsentAt?.toISOString() ?? null}
        noticed={!!row?.emailAiNoticeAt}
        aiEnabled={aiEnabled()}
        readOnly={isReadOnly(user)}
      />
    </div>
  );
}
