import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/AppProviders";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GetMeHired: Interview practice that knows your resume",
  description: "Personalized interview practice and evidence-based feedback. Built at HackRice 2026.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The dark-mode script below sets data-theme on this element before
      // hydration (to avoid a flash), which deliberately differs from the
      // server-rendered markup — expected, not a real mismatch.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script
          // Applies the saved dashboard theme + accessibility prefs before
          // paint, avoiding a light-mode flash for users who picked dark.
          // Scoped to dash-* tokens and a11y attributes only — doesn't
          // affect the marketing pages.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;if(localStorage.getItem("dashboard-theme")==="dark")d.setAttribute("data-theme","dark");if(localStorage.getItem("gmh-contrast")==="high")d.setAttribute("data-contrast","high");if(localStorage.getItem("gmh-motion")==="reduced")d.setAttribute("data-motion","reduced");}catch(e){}})();`,
          }}
        />
        <AppProviders>
          <SiteHeader />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
