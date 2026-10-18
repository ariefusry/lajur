import { describe, expect, it } from "vitest";
import { fetchJobPageText, focusJobText, htmlToText, isPrivateAddress, jobPostingFromJsonLd } from "./fetch-page";

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("blocks %s", (ip) => expect(isPrivateAddress(ip)).toBe(true));
  it.each(["8.8.8.8", "172.32.0.1", "104.18.1.1", "2606:4700::1111"])("allows %s", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe("fetchJobPageText guards", () => {
  it("rejects non-http schemes and internal hosts before fetching", async () => {
    await expect(fetchJobPageText("file:///etc/passwd")).rejects.toThrow(/http/);
    await expect(fetchJobPageText("http://127.0.0.1:3000/api/health")).rejects.toThrow(/tidak bisa diambil/);
    await expect(fetchJobPageText("http://[::1]/")).rejects.toThrow(/tidak bisa diambil/);
    await expect(fetchJobPageText("http://localhost/")).rejects.toThrow(/tidak bisa diambil/);
  });
});

describe("htmlToText", () => {
  it("drops scripts/styles, keeps structure, decodes entities", () => {
    const html = `<html><head><title>x</title><style>p{}</style></head><body><script>alert(1)</script>
      <h1>Software Engineer</h1><p>IPK &ge; 3.00 &amp; usia&nbsp;maks. 25</p><ul><li>SQL</li><li>Python</li></ul></body></html>`;
    const text = htmlToText(html);
    expect(text).not.toMatch(/alert|p\{\}/);
    expect(text).toContain("Software Engineer");
    expect(text).toContain("& usia maks. 25");
    expect(text).toMatch(/- SQL[\s\S]*- Python/);
  });
});

describe("jobPostingFromJsonLd", () => {
  const ld = (data: unknown) =>
    `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body><div id="root"></div></body></html>`;
  const posting = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: "Magang Bagian Perencanaan",
    hiringOrganization: { "@type": "Organization", name: "PT Contoh Tbk" },
    jobLocation: { "@type": "Place", address: { addressLocality: "Bandung", addressRegion: "Jawa Barat" } },
    validThrough: "2026-11-30T23:59:59+07:00",
    description: "<p>Kualifikasi:</p><ul><li>IPK minimal 3,00</li><li>Menguasai Excel</li></ul>",
  };
  it("reads a JS-rendered page's embedded JobPosting", () => {
    const text = jobPostingFromJsonLd(ld(posting));
    expect(text).toContain("Posisi: Magang Bagian Perencanaan");
    expect(text).toContain("Perusahaan: PT Contoh Tbk");
    expect(text).toContain("Lokasi: Bandung, Jawa Barat");
    expect(text).toContain("Batas pendaftaran: 2026-11-30");
    expect(text).toMatch(/- IPK minimal 3,00[\s\S]*- Menguasai Excel/);
  });
  it("finds it inside @graph and ignores other/invalid blocks", () => {
    const html =
      `<script type="application/ld+json">{oops</script>` + ld({ "@graph": [{ "@type": "WebPage" }, posting] });
    expect(jobPostingFromJsonLd(html)).toContain("PT Contoh Tbk");
    expect(jobPostingFromJsonLd(ld({ "@type": "Organization", name: "x" }))).toBe("");
  });
});

describe("focusJobText", () => {
  it("keeps short text as is", () => expect(focusJobText("Kualifikasi: S1", 100)).toBe("Kualifikasi: S1"));
  it("finds an ad buried after a long menu", () => {
    const menu = "Beranda\nTentang Kami\nCari Lowongan\n".repeat(4000); // ~120k chars, one weak keyword per line
    const ad =
      "Rincian Lowongan\nMagang Logistik\nKualifikasi:\n- Jurusan Logistik\n- IPK minimal 3,00\nPersyaratan lain: penempatan Jakarta";
    const out = focusJobText(menu + ad + "\nFooter", 2000);
    expect(out).toHaveLength(2000);
    expect(out).toContain("Jurusan Logistik");
    expect(out).toContain("IPK minimal 3,00");
  });
  it("prefers keyword variety over a filter that repeats one keyword", () => {
    const filter = "Pendidikan\n".repeat(105);
    const ad =
      "Kualifikasi:\n- Jurusan Logistik\n- IPK minimal 3,1\nPersyaratan Dokumen\nPenutupan lamaran: 18 Oktober 2026";
    const text = "Menu\n".repeat(2000) + filter + "x".repeat(30_000) + ad + "\nFooter\n".repeat(100);
    expect(focusJobText(text, 5000)).toContain("IPK minimal 3,1");
  });
  it("falls back to the head when there are no keywords", () => {
    expect(focusJobText("x".repeat(500), 100)).toBe("x".repeat(100));
  });
});
