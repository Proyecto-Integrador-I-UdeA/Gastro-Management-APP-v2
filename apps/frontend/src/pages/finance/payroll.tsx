"use client";

import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function FinancePayrollPage() {
  useAuthGuard("accounting.read");

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <h1 className="text-3xl font-bold text-[#001F3F]">Nómina</h1>
        <p className="mt-2 text-gray-600">
          Este submódulo queda reservado. Se trabaja después de Gastos.
        </p>
      </div>
    </DashboardLayout>
  );
}
