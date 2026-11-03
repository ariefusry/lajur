import { ImageResponse } from "next/og";
import { OG_IMAGE, SITE_NAME, SITE_TAGLINE } from "@/lib/site";

// Rendered at build time with next/og's bundled font, so the build never fetches fonts from the network.
export const alt = OG_IMAGE.alt;
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
export const contentType = "image/png";

// Landing colours (globals.css): grouped background, brand blue, near-black text.
const BACKGROUND = "#f6f6f8";
const BRAND = "#1f5fd8";
const TEXT = "#111111";
const MUTED = "#5b5f6b";

const STAGES = ["Administrasi", "Tes Online/TPA", "Psikotes", "LGD", "Interview", "MCU"];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          backgroundColor: BACKGROUND,
          backgroundImage: "radial-gradient(circle at 85% 10%, rgba(31, 95, 216, 0.18), transparent 55%)",
          color: TEXT,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* The Lajur mark (components/logo.tsx): an L built from two cards. */}
          <svg width="72" height="72" viewBox="0 0 256 256">
            <rect x="57" y="27" width="60" height="200" rx="22" fill={BRAND} />
            <rect x="131" y="159" width="68" height="68" rx="22" fill={BRAND} />
          </svg>
          <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: "-0.03em" }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.035em", maxWidth: 980 }}>
            {SITE_TAGLINE}
          </div>
          <div style={{ fontSize: 32, color: MUTED, maxWidth: 960 }}>
            Tracker lamaran kerja gratis untuk pencari kerja di Indonesia.
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {STAGES.map((stage) => (
            <div
              key={stage}
              style={{
                display: "flex",
                padding: "10px 20px",
                borderRadius: 999,
                background: "#ffffff",
                border: "1px solid #e3e4e8",
                color: BRAND,
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              {stage}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
