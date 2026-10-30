import "server-only";
import {
  InterviewPrepAnswer,
  MAX_QUESTIONS,
  MAX_QUESTIONS_TO_ASK,
  verifyInterviewPrep,
  type InterviewKind,
  type StoredInterviewPrep,
} from "@/lib/ai/interview-prep";
import { generateStructured } from "@/lib/ai/provider";
import { redact, type KnownPii } from "@/lib/ai/redact";
import { REQUIREMENT_TYPE_LABELS } from "@/lib/validation";

// Groq's free tier is 8K tokens/minute for input and output together, so both texts are capped below their usual limits.
const MAX_POSTING_CHARS = 5000;
const MAX_CV_CHARS = 3500;

const KIND_GUIDE: Record<InterviewKind, string> = {
  HR: `Interview HR. Campur kategori "motivasi", "hr", dan "perilaku": alasan melamar ke perusahaan ini, kelebihan dan kekurangan, bekerja dalam tim atau menghadapi konflik, rencana karier. Kalau ada "Gaji yang diharapkan", tambahkan pertanyaan ekspektasi gaji. Kalau ada syarat penempatan atau ikatan dinas, tambahkan pertanyaan kesediaan.`,
  USER: `Interview user (calon atasan atau tim). Utamakan kategori "teknis" dan "situasional" dari skill dan tugas yang tertulis di lowongan, ditambah satu atau dua "perilaku" tentang pengalaman proyek.`,
  LGD: `Diskusi kelompok (LGD). Tiap "question" adalah contoh topik diskusi yang masuk akal untuk bidang lowongan ini (kategori "situasional" atau "perilaku"). "answerPoints" berisi cara berkontribusi di diskusi itu: membuka, mengusulkan sudut pandang, menanggapi, menutup. "why" menjelaskan apa yang dinilai penilai.`,
  GENERAL: `Interview secara umum untuk lowongan ini. Campur kategori "motivasi", "perilaku", "teknis", dan "situasional".`,
};

export function interviewPrepSystem(kind: InterviewKind) {
  return `Kamu menyiapkan pencari kerja di Indonesia untuk satu interview. Tulis dalam bahasa Indonesia.
Kamu menerima data lowongan, jenis interview, dan (kalau ada) potongan CV yang sudah disamarkan: nama, kontak, dan alamat diganti tanda seperti [NAME_1]. Biarkan tanda itu apa adanya.

${KIND_GUIDE[kind]}

questions: ${MAX_QUESTIONS} pertanyaan, urut dari yang paling mungkin ditanyakan. Tiap item:
- category: salah satu dari motivasi, perilaku, teknis, situasional, hr.
- question: satu pertanyaan, seperti yang diucapkan pewawancara.
- why: satu kalimat, mengapa pewawancara menanyakannya, dikaitkan dengan isi lowongan.
- quote: potongan teks yang disalin persis dari lowongan yang mendasari "why". null kalau tidak ada.
- answerPoints: 2 sampai 4 poin kerangka jawaban berpola STAR (situasi, tugas, aksi, hasil) dalam bentuk arahan, contoh "Ceritakan proyek di mana kamu ... dan hasil yang bisa diukur". Kamu tidak tahu pengalaman user selain isi CV, jadi jangan menulis seolah-olah user sudah mengalaminya.
- cvQuote: potongan teks yang disalin persis dari CV yang bisa jadi bahan jawaban. null kalau CV tidak ada atau tidak relevan.
- tip: satu kalimat saran menjawab atau hal yang perlu dihindari.

questionsToAsk: ${MAX_QUESTIONS_TO_ASK} pertanyaan yang pantas diajukan user kepada pewawancara, spesifik untuk posisi ini.

Aturan:
- Dilarang menulis fakta tentang perusahaan (produk, budaya, nilai, berita) yang tidak tertulis di lowongan.
- Dilarang menambah angka, tahun, tools, skill, atau pencapaian yang tidak ada di lowongan atau CV.
- Kalau lowongan tidak ada, buat pertanyaan umum untuk posisi itu dan jangan mengutip apa pun.`;
}

type PrepInput = {
  company: string;
  position: string;
  postingText: string | null;
  expectedSalary: number | null;
  requirements: { type: keyof typeof REQUIREMENT_TYPE_LABELS; value: string }[];
  stageName: string;
  kind: InterviewKind;
  /** Text of the CV sent with the application, or null. */
  cvText: string | null;
};

export function interviewPrepPrompt(input: PrepInput, posting: string, redactedCv: string) {
  const lines = [
    `Jenis interview: ${input.stageName}`,
    `Perusahaan: ${input.company}`,
    `Posisi: ${input.position}`,
    input.expectedSalary && `Gaji yang diharapkan: Rp${input.expectedSalary.toLocaleString("id-ID")} per bulan`,
    // Readable labels, not enum codes: the model repeats whatever it sees in its tips.
    ...input.requirements.map((r) => `Syarat (${REQUIREMENT_TYPE_LABELS[r.type].toLowerCase()}): ${r.value}`),
  ].filter(Boolean);
  return `${lines.join("\n")}\n\nLowongan:\n${posting || "(tidak ada teks lowongan)"}\n\nCV:\n${redactedCv || "(tidak ada CV)"}`;
}

/**
 * Questions and answer outlines for one application at one stage. Only the posting, company, position, expected
 * salary and the redacted CV go to the AI; stage notes never do. Throws AiConsentRequiredError, QuotaExceededError
 * or AiUnavailableError, which the route turns into messages.
 */
export async function generateInterviewPrep(
  input: PrepInput & { owner: KnownPii; userId: string },
): Promise<StoredInterviewPrep> {
  const posting = (input.postingText ?? "").slice(0, MAX_POSTING_CHARS);
  const cv = input.cvText ? redact(input.cvText, input.owner) : { text: "", map: {} };
  const redactedCv = cv.text.slice(0, MAX_CV_CHARS);
  const { object } = await generateStructured({
    schema: InterviewPrepAnswer,
    system: interviewPrepSystem(input.kind),
    prompt: interviewPrepPrompt(input, posting, redactedCv),
    feature: "INTERVIEW_PREP",
    userId: input.userId,
  });
  const known = [
    input.company,
    input.position,
    input.expectedSalary && `Rp${input.expectedSalary.toLocaleString("id-ID")}`,
    ...input.requirements.map((r) => r.value),
  ]
    .filter(Boolean)
    .join("\n");
  const verified = verifyInterviewPrep(object, { posting, redactedCv, known }, cv.map);
  return {
    stageName: input.stageName,
    kind: input.kind,
    generatedAt: new Date().toISOString(),
    usedPosting: posting.length > 0,
    usedCv: redactedCv.length > 0,
    ...verified,
  };
}
