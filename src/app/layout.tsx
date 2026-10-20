import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans", // globals.css maps --font-sans (shadcn)
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lajur",
  description: "Tracker lamaran kerja untuk pencari kerja di Indonesia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Font variables on <html>: globals.css applies font-sans to html, which must see --font-sans.
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          {/* On phones, clear the app's bottom tab bar. */}
          <Toaster
            richColors
            position="bottom-right"
            mobileOffset={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}
          />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
