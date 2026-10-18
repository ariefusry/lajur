import { expect, test, type Page } from "@playwright/test";

// CLAUDE.md Fase 5: login demo → buat lamaran → geser tahap → cek dashboard.
// Runs on the seeded demo account (15 applications) and deletes what it creates, so it can be re-run.

const COMPANY = `PT Uji E2E ${Date.now()}`;

async function dragCard(page: Page, company: string, toColumn: string) {
  const card = page.locator("section", { has: page.getByText(company) }).getByText(company);
  const target = page.getByRole("region", { name: toColumn });
  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // dnd-kit needs real pointer movement past its 6 px activation distance.
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 20 });
  await page.mouse.up();
}

test("demo user creates an application, moves it on the board, and sees it on the dashboard", async ({ page }) => {
  // 1. Login demo
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  // 2. Buat lamaran (lands in the first column, Wishlist)
  await page.goto("/applications/new");
  // With AI configured the manual form is folded behind a button.
  await page.waitForLoadState("networkidle"); // the click needs hydration
  const manual = page.getByRole("button", { name: /Isi manual/ });
  if (await manual.isVisible()) await manual.click();
  await page.getByLabel("Perusahaan *").fill(COMPANY);
  await page.getByLabel("Posisi *").fill("Staf Administrasi");
  await page.getByLabel("Sumber lowongan *").click(); // custom dropdown (page-drawn list)
  await page.getByRole("option", { name: "JobStreet" }).click();
  await page.getByLabel("Tanggal melamar").fill("2026-10-01");
  await page.getByRole("button", { name: "Simpan lamaran" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByRole("region", { name: "Wishlist" }).getByText(COMPANY)).toBeVisible();

  // 3. Geser ke Administrasi (optimistic on screen, then the server action); position survives a reload
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/board");
  await dragCard(page, COMPANY, "Administrasi");
  await expect(page.getByRole("region", { name: "Administrasi" }).getByText(COMPANY)).toBeVisible();
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole("region", { name: "Administrasi" }).getByText(COMPANY)).toBeVisible();

  // Forward then back again is a correction: the timeline must not repeat stages
  for (const column of ["Tes Online/TPA", "Administrasi"]) {
    const moved = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/board");
    await dragCard(page, COMPANY, column);
    expect((await moved).ok()).toBe(true);
  }
  await page.reload();
  await expect(page.getByRole("region", { name: "Administrasi" }).getByText(COMPANY)).toBeVisible();

  // History recorded on the detail page
  await page.getByRole("region", { name: "Administrasi" }).getByText(COMPANY).click();
  await expect(page.getByRole("heading", { name: COMPANY })).toBeVisible();
  const timeline = page.locator("section", { has: page.getByRole("heading", { name: "Timeline tahap" }) });
  await expect(timeline.getByText("Wishlist")).toBeVisible();
  await expect(timeline.getByText("Administrasi", { exact: true })).toHaveCount(1);
  await expect(timeline.getByText("Tes Online/TPA", { exact: true })).toHaveCount(0);
  const detailUrl = page.url();

  // 4. Cek dashboard: the move shows up in recent activity; the list view has it too
  await page.goto("/dashboard");
  const activity = page.locator("section", { has: page.getByRole("heading", { name: "Aktivitas terbaru" }) });
  await expect(activity.getByText(COMPANY).first()).toBeVisible();
  await page.goto(`/applications?q=${encodeURIComponent(COMPANY)}`);
  await expect(page.getByText("1 dari")).toBeVisible();
  await expect(page.getByRole("link", { name: COMPANY }).first()).toBeVisible();

  // Cleanup
  await page.goto(detailUrl);
  await page.getByRole("button", { name: "Hapus lamaran" }).click();
  await page.getByRole("button", { name: "Ya, hapus" }).click(); // inline confirmation
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByText(COMPANY)).toHaveCount(0);

  // "Urungkan" brings it back, still in Administrasi, with its history
  await page.getByRole("button", { name: "Urungkan" }).click();
  await expect(page.getByRole("region", { name: "Administrasi" }).getByText(COMPANY)).toBeVisible();
  await page.goto(detailUrl);
  await expect(timeline.getByText("Wishlist")).toBeVisible();

  // Delete for real (the undo toast is ignored)
  await page.getByRole("button", { name: "Hapus lamaran" }).click();
  await page.getByRole("button", { name: "Ya, hapus" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByText(COMPANY)).toHaveCount(0);
});

// Every page renders for the demo account (server/client boundary mistakes only show up at runtime).
test("all main pages render", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  for (const [path, heading] of [
    ["/dashboard", "Dashboard"],
    ["/analytics", "Analytics"],
    ["/board", "Lamaran"],
    ["/applications", "Lamaran"],
    ["/applications/new", "Lamaran baru"],
    ["/calendar", /\d{4}/],
    ["/resumes", "CV"],
    ["/settings", "Pengaturan"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText("Terjadi kesalahan")).toHaveCount(0);
  }
});

test("landing page for visitors", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Semua lamaran kerjamu/ })).toBeVisible();
  await page.getByRole("link", { name: "Masuk" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
});
