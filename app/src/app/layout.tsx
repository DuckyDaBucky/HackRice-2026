import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/marketing/Footer";
import { Nav } from "@/components/marketing/Nav";
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
  description:
    "GetMeHired is a pre-launch technical-behavioral interview practice and screening platform. Get notified when recorded practice interviews open.",
  metadataBase: new URL("https://getmehired.today"),
  openGraph: {
    title: "GetMeHired",
    description:
      "Contextual interview practice and employer screening, grounded in your actual resume and transcript-linked evidence.",
    url: "https://getmehired.today",
    siteName: "GetMeHired",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GetMeHired",
    description: "Interview practice that knows your resume. Coming soon.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </ClerkProvider>
      </body>
    </html>
  );
}
