import { traduireReponse } from "./erreurs";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  return traduireReponseServeur(res);
}

// Si la réponse est du JSON avec un "message", on le traduit selon la langue choisie.
// Les autres réponses (fichiers, réponses vides) sont rendues telles quelles.
export async function traduireReponseServeur(res: Response): Promise<Response> {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/json") || res.status === 204) return res;

  const texte = await res.text();
  let corps = texte;
  try {
    corps = JSON.stringify(traduireReponse(JSON.parse(texte)));
  } catch {
    // Pas du JSON valide : on garde le texte d'origine
  }
  return new Response(corps, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}