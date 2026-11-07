import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { LangueProvider } from "./lib/langue";


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
  // Nom neutre : chaque centre a sa propre identité une fois connecté
  title: estProduction ? "Espace de gestion" : "[TEST] Espace de gestion",
  description: "Gestion des candidats, factures et paiements",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${fraunces.variable} ${inter.variable} antialiased`}>
        {/* Langue choisie (français / anglais) disponible dans toutes les pages */}
        <LangueProvider>{children}</LangueProvider>
      </body>
    </html>
  );
}