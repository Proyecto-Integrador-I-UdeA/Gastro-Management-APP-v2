const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://gastro-management-app-production-6187.up.railway.app";

console.log("🌍 BUILD NUEVO EJECUTANDOSE");

const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
};

export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
) => {
  const token = getToken();

  // 🔥 VALIDACIÓN CLAVE
  if (!API_URL) {
    console.error("❌ API_URL no definida");
    throw new Error("API_URL no está configurada");
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token && token !== "null") {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const url = `${API_URL}${endpoint}`;
    console.log("🚀 Request a:", url);

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("❌ RESPUESTA RAW DEL BACKEND:", text);
      throw new Error(text || "Respuesta no válida");
    }

    if (!res.ok) {
      console.error("❌ Backend respondió error:", data);
      throw new Error(data?.error || "Error en la petición");
    }

    return data;
  } catch (error) {
    console.error("API ERROR:", error);
    throw error;
  }
};