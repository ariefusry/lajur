import { describe, expect, it } from "vitest";
import { buildSearchLinks, searchKeywords } from "./search-links";

const byPortal = (links: ReturnType<typeof buildSearchLinks>) =>
  Object.fromEntries(links.map((l) => [l.portal, l.url]));

describe("searchKeywords", () => {
  it("joins the role and at most one skill, skipping blanks", () => {
    expect(searchKeywords({ role: " Frontend Developer ", skill: "React" })).toBe("Frontend Developer React");
    expect(searchKeywords({ role: "Data Analyst", skill: null })).toBe("Data Analyst");
  });
});

describe("buildSearchLinks", () => {
  it("builds the four portal URLs from role, skill and city", () => {
    const urls = byPortal(buildSearchLinks({ role: "Frontend Developer", skill: "React", city: "Jakarta" }));
    expect(urls.Jobstreet).toBe("https://id.jobstreet.com/id/frontend-developer-react-jobs/in-Jakarta");
    expect(urls.Glints).toBe(
      "https://glints.com/id/opportunities/jobs/explore?keyword=Frontend+Developer+React&country=ID&locationName=Jakarta",
    );
    expect(urls.LinkedIn).toBe(
      "https://www.linkedin.com/jobs/search/?keywords=Frontend%20Developer%20React&location=Jakarta%2C%20Indonesia&f_TPR=r604800",
    );
    expect(urls.Kalibrr).toBe("https://www.kalibrr.com/id-ID/job-board/te/frontend-developer-react/1");
  });

  it("drops the city parts when no city is given (LinkedIn falls back to the country)", () => {
    const urls = byPortal(buildSearchLinks({ role: "Data Analyst", skill: null, city: "  " }));
    expect(urls.Jobstreet).toBe("https://id.jobstreet.com/id/data-analyst-jobs");
    expect(urls.Glints).toBe("https://glints.com/id/opportunities/jobs/explore?keyword=Data+Analyst&country=ID");
    expect(urls.LinkedIn).toContain("location=Indonesia&");
  });

  it('strips the "Kota"/"Kabupaten" prefix of a profile domicile', () => {
    const urls = byPortal(buildSearchLinks({ role: "Staff Admin", skill: null, city: "Kota Bekasi" }));
    expect(urls.Jobstreet).toBe("https://id.jobstreet.com/id/staff-admin-jobs/in-Bekasi");
    expect(urls.Glints).toContain("locationName=Bekasi");
    const kab = byPortal(buildSearchLinks({ role: "Staff Admin", skill: null, city: "Kabupaten Bogor" }));
    expect(kab.Jobstreet).toContain("/in-Bogor");
  });

  it("encodes special characters and folds accents in slugs", () => {
    const urls = byPortal(buildSearchLinks({ role: "C++ Developer", skill: "R&D", city: "Yogyakarta" }));
    expect(urls.Glints).toContain("keyword=C%2B%2B+Developer+R%26D");
    expect(urls.LinkedIn).toContain("keywords=C%2B%2B%20Developer%20R%26D");
    expect(urls.Kalibrr).toBe("https://www.kalibrr.com/id-ID/job-board/te/c-developer-r-d/1");
    const accent = byPortal(buildSearchLinks({ role: "Analis Data Pemasaran Café", skill: null, city: "" }));
    expect(accent.Kalibrr).toContain("/analis-data-pemasaran-cafe/");
  });

  it("returns no links without a role", () => {
    expect(buildSearchLinks({ role: " ", skill: "React", city: "Jakarta" })).toEqual([]);
  });

  it("only LinkedIn carries the freshness filter; Kalibrr has no city", () => {
    const links = buildSearchLinks({ role: "QA", skill: null, city: "Bandung" });
    expect(links.find((l) => l.portal === "LinkedIn")?.note).toBe("7 hari terakhir");
    expect(links.find((l) => l.portal === "Kalibrr")?.url).not.toContain("Bandung");
  });
});
