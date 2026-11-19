"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// L'ancienne page « Plans et paiements » est maintenant divisée en trois
// pages (Plans, Paiements, Régler un abonnement) : on renvoie vers Paiements.
export default function AnciennePageAbonnements() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/super-admin/paiements");
  }, [router]);
  return null;
}