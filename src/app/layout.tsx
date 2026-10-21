import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ServiceWorker } from "@/components/service-worker";
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
  // Installed from Safari's "Add to Home Screen": open full screen with this name.
  appleWebApp: { capable: true, title: "Lajur", statusBarStyle: "default" },
};

// Browser/status bar colour of the installed app, matching the page background in each theme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
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
        <ServiceWorker />
      </body>
    </html>
  );
}
