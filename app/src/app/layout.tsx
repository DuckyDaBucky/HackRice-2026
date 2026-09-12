import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthControls } from "@/components/auth-controls";
import { AuthProvider } from "@/components/auth-provider";
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
  title: "HackRice 2026",
  description: "HackRice 2026",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <header className="flex items-center justify-end gap-4 p-4">
            <AuthControls />
          </header>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}