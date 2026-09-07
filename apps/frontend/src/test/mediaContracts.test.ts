import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";

describe("contratos frontend de medios", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resuelve rutas relativas contra el API sin hardcodear frontend ni puertos", () => {
    expect(resolveMediaUrl(
      "/menu-media/files/asset.png",
      "https://api.example.test/",
    )).toBe("https://api.example.test/menu-media/files/asset.png");
    expect(resolveMediaUrl(
      "https://cdn.example.test/asset.png",
      "https://api.example.test",
    )).toBe("https://cdn.example.test/asset.png");
    expect(resolveMediaUrl(null, "https://api.example.test")).toBeNull();
  });

  it("no fija Content-Type al enviar FormData y conserva autorización", async () => {
    localStorage.setItem("token", "token-de-prueba");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ assetId: 12 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const multipart = new FormData();
    multipart.append("image", new File(["bytes"], "menu.png", { type: "image/png" }));

    await apiFetch("/menu-media/images", { method: "POST", body: multipart });

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(options.headers);
    expect(headers.get("Content-Type")).toBeNull();
    expect(headers.get("Authorization")).toBe("Bearer token-de-prueba");
  });
});
