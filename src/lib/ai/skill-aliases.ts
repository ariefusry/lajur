// Skill names that mean the same thing. Matching against the CV tries every alias of the skill's group,
// so "Postgres" in a posting matches "PostgreSQL" in a CV and vice versa.
const GROUPS: string[][] = [
  ["javascript", "js", "ecmascript", "es6"],
  ["typescript", "ts"],
  ["react", "react.js", "reactjs"],
  ["next.js", "nextjs", "next"],
  ["vue", "vue.js", "vuejs"],
  ["angular", "angular.js", "angularjs"],
  ["node.js", "nodejs", "node"],
  ["express", "express.js", "expressjs"],
  ["postgresql", "postgres", "psql"],
  ["mysql"],
  ["mongodb", "mongo"],
  ["sql", "structured query language"],
  ["microsoft excel", "ms excel", "excel"],
  ["microsoft word", "ms word"],
  ["power bi", "powerbi"],
  ["tailwind css", "tailwind", "tailwindcss"],
  ["golang", "go"],
  ["c#", "csharp", "c sharp"],
  ["c++", "cpp"],
  [".net", "dotnet", "asp.net"],
  ["amazon web services", "aws"],
  ["google cloud platform", "google cloud", "gcp"],
  ["kubernetes", "k8s"],
  ["machine learning", "ml"],
  ["rest api", "restful api", "rest", "restful"],
  ["git", "github", "gitlab"],
  ["figma"],
  ["python"],
  ["java"],
  ["php"],
  ["laravel"],
  ["docker"],
  // Office, finance, design, engineering, language, certifications: common outside IT too.
  ["microsoft powerpoint", "ms powerpoint", "powerpoint", "ppt"],
  ["microsoft office", "ms office"],
  ["google sheets"],
  ["sap", "sap erp", "sap s/4hana"],
  ["accurate", "accurate accounting"],
  ["myob"],
  ["zahir", "zahir accounting"],
  ["akuntansi", "accounting", "pembukuan"],
  ["perpajakan", "pajak", "taxation", "tax"],
  ["brevet", "brevet a", "brevet b", "brevet a&b", "brevet ab"],
  ["autocad", "auto cad"],
  ["solidworks", "solid works"],
  ["sketchup", "sketch up"],
  ["canva"],
  ["adobe photoshop", "photoshop"],
  ["adobe illustrator", "illustrator"],
  ["adobe premiere", "premiere pro", "premiere"],
  ["coreldraw", "corel draw", "corel"],
  ["spss"],
  ["bahasa inggris", "english", "inggris", "toefl", "ielts", "toeic"],
  ["bahasa mandarin", "mandarin", "chinese", "hsk"],
  ["bahasa jepang", "japanese", "jlpt"],
  ["k3", "hse", "keselamatan dan kesehatan kerja", "ahli k3"],
  ["sim a", "sim-a"],
  ["sim c", "sim-c"],
  ["digital marketing", "pemasaran digital"],
  ["seo", "search engine optimization"],
  ["social media", "media sosial"],
  ["public speaking"],
  ["customer service", "pelayanan pelanggan", "layanan pelanggan"],
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** All spellings to look for when checking whether a CV mentions `skill`. */
export function skillAliases(skill: string): string[] {
  const s = norm(skill);
  const group = GROUPS.find((g) => g.includes(s));
  return group ?? [s];
}

/**
 * The CV line that mentions the skill (any alias, case-insensitive, whole word so "Java" doesn't match
 * "JavaScript" and "Go" doesn't match "Google"), or null.
 */
export function findSkillInText(skill: string, text: string): string | null {
  const pattern = skillAliases(skill)
    .map((a) => `(?<![\\p{L}\\p{N}+#.])${escapeRegExp(a)}(?![\\p{L}\\p{N}+#]|\\.[\\p{L}])`)
    .join("|");
  const re = new RegExp(pattern, "iu");
  return text.split("\n").find((line) => re.test(line))?.trim() ?? null;
}
