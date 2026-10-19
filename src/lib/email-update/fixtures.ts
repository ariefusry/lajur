import type { PlanSummary } from "./plan.ts";

export type EmailFixture = {
  name: string;
  text: string;
  userName: string;
  /** Personal data and credentials that must never reach the AI. */
  secrets: string[];
  /** The plan a correct reading gives for an application in Administrasi, with the BUMN stages. */
  expect: PlanSummary;
};

// Made-up personal data; the shapes mirror real recruitment emails.
export const EMAIL_FIXTURES: EmailFixture[] = [
  {
    name: "Apple Developer Academy - test invite with window",
    expect: {
      kind: "TEST_INVITE",
      move: "Tes Online/TPA",
      events: [{ type: "ONLINE_TEST", startsAt: "2026-09-24T04:00:00.000Z", opensAt: "2026-09-17T01:00:00.000Z" }],
      fail: null,
      notes: true,
    },
    userName: "Budi Santoso Pratama",
    secrets: ["Budi"],
    text: `Hi Budi,
Congratulations! You are one step closer to becoming a learner of Apple Developer Academy Indonesia – Cohort 2027.
We are pleased to invite you to take the Online Entry Test, a critical part of the selection process. The test will take approximately 120 minutes, so please allocate sufficient time in a quiet and comfortable environment.
You may take the test only once, using a PC or laptop equipped with a working microphone and webcam. Before starting, please click the button below to ensure your device is compatible:
    Check System Compatibility

PLEASE READ ALL THE INSTRUCTIONS BELOW.

Test Details

    Test Duration: 120 minutes
    Sections:
        Section 1: Logic Test
        Section 2: Programming Test

Test Schedule

    Test Open        : September 17, 2026 - 08:00 WIB (GMT+7)
    Test Closes     : September 24, 2026 - 11:00 WIB (GMT+7)

Note: You must click "Start Test" button before the closing time on September 24, 2026, at 11:00 WIB (GMT+7).

Test Rules and Instructions

    Log in using the same email address and personal ID number (KTP / Foreign ID / Passport) used during your Academy application form.
    DO NOT click the "FINISH" button before completing all sections.
    Navigating away from the test page may result in disqualification. This includes switching between browser tabs.`,
  },
  {
    name: "Peepl - assessment window with credentials",
    expect: {
      kind: "TEST_INVITE",
      move: "Tes Online/TPA",
      events: [{ type: "ONLINE_TEST", startsAt: "2026-10-01T02:00:00.000Z", opensAt: "2026-09-29T07:00:00.000Z" }],
      fail: null,
      notes: true,
    },
    userName: "Budi Santoso Pratama",
    secrets: ["Budi Santoso", "APSC0012345", "Qm7rT2xa"],
    text: ` Hi Budi Santoso,
Terima kasih atas ketertarikan Anda untuk bergabung dengan Peepl.
Sebagai bagian dari proses seleksi, kami mengundang Anda untuk mengikuti rangkaian asesmen online yang diselenggarakan melalui Nucleus.
Perlu diketahui bahwa terdapat beberapa jenis asesmen yang perlu Anda selesaikan dan instruksi lengkap untuk masing-masing asesmen akan tersedia setelah Anda masuk ke platform Nucleus.
Asesmen ini dapat dikerjakan dalam periode berikut:
Mulai     :     29 September 2026 14:00 WIB
Selesai     :     01 October 2026 09:00 WIB
Untuk mengakses asesmen, silakan menggunakan informasi berikut:
Username     :     APSC0012345
Password     :     Qm7rT2xa
Link     :     https://participants-nucleus.peepl.tech
Silakan menyelesaikan seluruh asesmen di tempat yang tenang serta dengan koneksi internet yang stabil.
Terima kasih dan semoga sukses dalam menyelesaikan asesmen Anda!
Salam hangat,
Tim Rekrutmen
Peepl`,
  },
  {
    name: "ISS Indonesia - document request",
    expect: {
      kind: "DOCUMENT_REQUEST",
      move: null,
      events: [{ type: "DEADLINE", startsAt: "2026-09-24T16:59:00.000Z", opensAt: null }],
      fail: null,
      notes: true,
    },
    userName: "Budi Santoso Pratama",
    secrets: ["isstalentmanagement@id.issworld.com"],
    text: `Talent Management – ISS Indonesia <isstalentmanagement@id.issworld.com>

Fri, Sep 18, 3:22 PM

to

Dear Great Candidate,

Greetings from ISS Indonesia!

Thank you for your interest in joining ISS Indonesia. We are pleased to invite you to continue to the next stage of our selection process.

As part of this stage, you are required to submit the following documents:

    Your updated CV
    Valid English proficiency certificate with a minimum score of 500 on the TOEFL or 6.0 on the IELTS

Please send both documents to this email and rename your files using the following format:

    CV_[Your Name] (e.g., CV_AnnisaAzalia)
    EnglishCertificate_[Your Name] (e.g., EnglishCertificate_AnnisaAzalia)

Please ensure that your documents are submitted no later than Thursday, 24th September 2026.

Best Regards,

Talent Management Team

ISS Indonesia`,
  },
  {
    name: "Astra portal - application received",
    expect: { kind: "APPLICATION_RECEIVED", move: null, events: [], fail: null, notes: false },
    userName: "Budi Santoso Pratama",
    secrets: [],
    text: `Function

Vacancy Title

Company

Link

Information Technology

Mobile Developer - GSI

PT Global Service Indonesia

https://career.astra.co.id/lowongan/lowongan-detail-page/13642/Mobile+Developer+-+GSI`,
  },
  {
    name: "BNI - rejection after online assessment",
    expect: { kind: "REJECTION", move: "Ditolak", events: [], fail: "Tes Online/TPA", notes: false },
    userName: "Budi Santoso Pratama",
    secrets: ["Budi Santoso Pratama", "ODPIT/07092026/CHTELKOMIT/0999"],
    text: `BNI Talent Search <talentsearch@bni.co.id>

Tue, Sep 15, 12:14 PM

to me

Dear Sdr. Budi Santoso Pratama

Semangat Pagi,

Melalui email ini, kami dari Tim Talent Acquisition BNI mengucapkan terima kasih atas keikutsertaan Saudara dalam proses tahapan seleksi rekrutmen ODP BNI s.d tahapan seleksi Online Assesment.

Dapat kami sampaikan untuk peserta :

Nama : Budi Santoso Pratama

Kode ID : ODPIT/07092026/CHTELKOMIT/0999

Program : CHTELKOMIT ODP IT

Berdasarkan hasil seleksi terakhir yang Saudara ikuti, Saudara tidak dapat melanjutkan ke tahapan seleksi berikutnya.

Terima kasih atas keikutsertaan Saudara dalam program ini.

Best Regards

Tim Talent Acquisition

Divisi Human Capital Services (HCE)`,
  },
];
