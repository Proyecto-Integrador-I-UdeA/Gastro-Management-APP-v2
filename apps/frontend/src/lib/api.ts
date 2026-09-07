import { API_BASE_URL } from "@/config/apiBaseUrl";

export const API_URL = API_BASE_URL;

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

  const headers = new Headers(options.headers);
  const isMultipart = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!isMultipart && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token && token !== "null") {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const url = `${API_URL.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
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
