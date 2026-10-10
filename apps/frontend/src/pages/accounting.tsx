"use client";

import { useEffect } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";

export default function AccountingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    void router.replace("/finance");
  }, [router]);

  return (
    <DashboardLayout>
      <p className="text-gray-600">Redirigiendo a gestión financiera…</p>
    </DashboardLayout>
  );
}
