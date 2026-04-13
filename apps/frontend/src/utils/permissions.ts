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

/** Alineado con PUT /warehouses en backend (authorizeAny). */
export const PERMS_WAREHOUSE_MUTATE = [
  "warehouses.update",
  "transfers.create",
  "transfers.update",
] as const;

export function userCanMutateWarehouse(): boolean {
  const set = new Set(getUserPermissions());
  return PERMS_WAREHOUSE_MUTATE.some((k) => set.has(k));
}















