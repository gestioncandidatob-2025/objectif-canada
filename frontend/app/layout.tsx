import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";


const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const estProduction = process.env.NEXT_PUBLIC_APP_ENV === "production";

export const metadata: Metadata = {
  title: estProduction
    ? "Objectif Canada — Gestion des candidats"
    : "[TEST] Objectif Canada — Gestion des candidats",
  description: "Application de gestion des candidats",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${fraunces.variable} ${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}