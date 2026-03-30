export const getUserPermissions = (): string[] => {
  if (typeof window === "undefined") return [];

  const token = localStorage.getItem("token");
  if (!token) return [];

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return (payload.permissions || []).map((p: string) =>
      p.trim().toLowerCase()
    );
  } catch {
    return [];
  }
};















