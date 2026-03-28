import { useEffect } from "react";
import { useRouter } from "next/router";
import { hasPermission } from "@/utils/permissions";

export const useAuthGuard = (permission: string) => {
  const router = useRouter();

  useEffect(() => {
    if (!hasPermission(permission)) {
      alert("No cuentas con los permisos para acceder a este módulo");
      router.push("/dashboard");
    }
  }, []);
};