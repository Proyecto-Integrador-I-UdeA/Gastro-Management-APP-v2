"use client";

import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function FinanceExpensesPage() {
  useAuthGuard("accounting.read");

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <h1 className="text-3xl font-bold text-[#001F3F]">Gastos</h1>
        <p className="mt-2 text-gray-600">
          Aquí van los gastos fijos y los costos indirectos variables del periodo.
          La captura de rubros se arma en el siguiente paso.
        </p>
      </div>
    </DashboardLayout>
  );
}
