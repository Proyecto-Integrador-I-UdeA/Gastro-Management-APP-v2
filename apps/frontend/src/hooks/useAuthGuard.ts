import { useEffect } from "react";
import { useRouter } from "next/router";
import { showError } from "@/utils/toast";
import { getUserPermissions } from "@/utils/permissions";

export const useAuthGuard = (permission: string) => {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const userPermissions = getUserPermissions();
      const required = permission.trim().toLowerCase();

      if (!userPermissions.includes(required)) {
        showError("No tienes permiso para acceder a esta sección");
        router.push("/dashboard");
      }

    } catch (e) {
      console.error("Error leyendo token", e);
      router.push("/login");
    }
  }, [permission, router]);
};

/** Acceso si el token incluye al menos uno de los permisos (comparación en minúsculas). */
export const useAuthGuardAny = (anyOfPermissions: readonly string[]) => {
  const router = useRouter();
  const key = anyOfPermissions.join("\0");

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const userPermissions = getUserPermissions();
      const allowed = anyOfPermissions.some((p) =>
        userPermissions.includes(p.trim().toLowerCase())
      );

      if (!allowed) {
        showError("No tienes permiso para acceder a esta sección");
        router.push("/dashboard");
      }
    } catch (e) {
      console.error("Error leyendo token", e);
      router.push("/login");
    }
  }, [key, router]);
};