"use client";

import { Suspense } from "react";
import ListeCandidats from "../../components/ListeCandidats";

// La liste complète se trouve dans components/ListeCandidats.tsx
// (elle est aussi utilisée par la page Groupes)
export default function CandidatsPage() {
  return (
    <Suspense>
      <ListeCandidats />
    </Suspense>
  );
}