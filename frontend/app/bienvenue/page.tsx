"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  nom: string;
  email: string;
  role: string;
};

export default function BienvenuePage() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      router.push("/login");
      return;
    }
    setUser(JSON.parse(stored));
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Bienvenue, {user.nom} 👋</h1>
      <p className="text-gray-600">
        Connecté en tant que <span className="font-semibold">{user.role}</span>
      </p>
      <button
        onClick={handleLogout}
        className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
      >
        Se déconnecter
      </button>
    </div>
  );
}