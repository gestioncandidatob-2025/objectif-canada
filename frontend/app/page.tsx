"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Page d'accueil : plus de bouton, on redirige directement.
// - déjà connecté (jeton présent)  -> tableau de bord
// - pas connecté                    -> page de connexion
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    router.replace(token ? "/bienvenue" : "/login");
  }, [router]);

  return null;
}