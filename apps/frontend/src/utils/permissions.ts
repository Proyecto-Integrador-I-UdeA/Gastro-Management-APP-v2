export const getPermissionsFromToken = () => {
  if (typeof window === "undefined") return [];

  const token = localStorage.getItem("token");

  if (!token) return [];

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.permissions || [];
  } catch {
    return [];
  }
};

export const hasPermission = (permission: string) => {
  const permissions = getPermissionsFromToken();
  return permissions.includes(permission);
};