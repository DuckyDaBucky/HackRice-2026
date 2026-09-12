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
    >
      <body className="min-h-full flex flex-col">
        <script
          // Applies the saved dashboard theme before paint, avoiding a
          // light-mode flash for users who picked dark. Scoped to the
          // dash-* tokens only — doesn't affect the marketing pages.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("dashboard-theme");if(t==="dark")document.documentElement.setAttribute("data-theme","dark");}catch(e){}})();`,
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
