import { useEffect } from "react";
import { useRouter } from "next/router";
import { showError } from "@/utils/toast";

export const useAuthGuard = (permission: string) => {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));

      const userPermissions = (payload.permissions || []).map((p: string) =>
        p.trim().toLowerCase()
      );
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