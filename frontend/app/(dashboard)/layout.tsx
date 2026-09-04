"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

type User = {
  nom: string;
  role: string;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [pret, setPret] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (!token || !userStr) {
      router.push("/login");
      return;
    }
    setUser(JSON.parse(userStr));
    setPret(true);
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  }

  if (!pret || !user) {
    return null;
  }

  const estAdmin = user.role === "admin";

  const liens = [
    { href: "/bienvenue", label: "Accueil", visible: true },
    { href: "/enregistrement", label: "Enregistrement", visible: true },
    { href: "/candidats", label: "Liste des candidats", visible: true },
    { href: "/classes", label: "Classes", visible: true },
    { href: "/tarifs", label: "Tarifs", visible: estAdmin },
    { href: "/tableau-de-bord", label: "Tableau de bord", visible: estAdmin },
    { href: "/utilisateurs", label: "Utilisateurs", visible: estAdmin },
    { href: "/factures", label: "Factures", visible: true },
    { href: "/historique", label: "Historique", visible: estAdmin },
  ];

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="flex w-64 shrink-0 flex-col border-r border-ink/10 bg-white px-5 py-6">
        <Link href="/bienvenue" className="mb-8 block">
          <img
            src="/logo.jpeg"
            alt="Logo"
            className="h-14 w-auto object-contain"
          />
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {liens
            .filter((l) => l.visible)
            .map((lien) => {
              const actif = pathname === lien.href;
              return (
                <Link
                  key={lien.href}
                  href={lien.href}
                  className={
                    "rounded-lg px-4 py-2.5 text-sm font-medium transition " +
                    (actif
                      ? "bg-accent text-white"
                      : "text-ink-soft hover:bg-paper hover:text-ink")
                  }
                >
                  {lien.label}
                </Link>
              );
            })}
        </nav>

        <div className="mt-6 border-t border-ink/10 pt-4">
          <p className="mb-2 text-xs text-ink-soft">
            Connecté : <span className="font-medium text-ink">{user.nom}</span>
          </p>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-ink-soft transition hover:text-error"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}