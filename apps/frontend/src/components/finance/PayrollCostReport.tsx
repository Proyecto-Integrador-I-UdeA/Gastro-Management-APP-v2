import type { FinancePayrollArea, FinancePayrollPeriod } from "@/lib/financePayrollApi";

function currency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function sumEntries(period: FinancePayrollPeriod, getter: (entry: FinancePayrollPeriod["entries"][number]) => number) {
  return Number(period.entries.reduce((sum, entry) => sum + getter(entry), 0).toFixed(2));
}

function TotalRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-6 border-b border-slate-200 py-2 ${strong ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{currency(value)}</span>
    </div>
  );
}

export default function PayrollCostReport({
  period,
  areaLabels,
  onClose,
}: {
  period: FinancePayrollPeriod;
  areaLabels: Record<FinancePayrollArea, string>;
  onClose: () => void;
}) {
  const prima = sumEntries(period, (entry) => entry.primaProvision);
  const severance = sumEntries(period, (entry) => entry.severanceProvision);
  const severanceInterest = sumEntries(period, (entry) => entry.severanceInterestProvision);
  const vacation = sumEntries(period, (entry) => entry.vacationProvision);
  const employeeHealth = sumEntries(period, (entry) => entry.employeeHealthDeduction);
  const employerHealth = sumEntries(period, (entry) => entry.employerHealthContribution);
  const totalHealth = sumEntries(period, (entry) => entry.totalHealthContribution);
  const employeePension = sumEntries(period, (entry) => entry.employeePensionDeduction);
  const employerPension = sumEntries(period, (entry) => entry.employerPensionContribution);
  const totalPension = sumEntries(period, (entry) => entry.totalPensionContribution);
  const employerArl = sumEntries(period, (entry) => entry.employerArlContribution);

  return (
    <div className="payroll-cost-report-overlay fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 print:static print:bg-white print:p-0">
      <article aria-label="Informe administrativo de costos" className="payroll-cost-report mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
        <header className="border-b-2 border-[#001F3F] pb-4">
          <p className="font-bold tracking-wide text-[#001F3F]">GASTRO MANAGEMENT APP</p>
          <h2 className="mt-1 text-2xl font-bold">INFORME ADMINISTRATIVO DE COSTO LABORAL</h2>
          <p className="mt-1 text-sm text-slate-600">Período: {period.month}</p>
        </header>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="border-b text-left text-slate-600">
              <tr>
                <th className="py-2 pr-3">Empleado</th>
                <th className="py-2 pr-3">Área</th>
                <th className="py-2 pr-3">Salario</th>
                <th className="py-2 pr-3">Extras y recargos</th>
                <th className="py-2 pr-3">Auxilio</th>
                <th className="py-2 pr-3">Devengado</th>
                <th className="py-2 pr-3">Deducciones</th>
                <th className="py-2 pr-3">Neto</th>
                <th className="py-2 pr-3">Seg. social a girar</th>
                <th className="py-2 pr-3">Aportes empresa</th>
                <th className="py-2 pr-3">Provisiones</th>
                <th className="py-2">Costo restaurante</th>
              </tr>
            </thead>
            <tbody>
              {period.entries.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-semibold">{entry.fullName}</td>
                  <td className="py-2 pr-3">{areaLabels[entry.area] ?? entry.area}</td>
                  <td className="py-2 pr-3">{currency(entry.salary)}</td>
                  <td className="py-2 pr-3">{currency(entry.extras)}</td>
                  <td className="py-2 pr-3">{currency(entry.transportAid)}</td>
                  <td className="py-2 pr-3">{currency(entry.totalAccrued)}</td>
                  <td className="py-2 pr-3">{currency(entry.totalDeductions)}</td>
                  <td className="py-2 pr-3">{currency(entry.net)}</td>
                  <td className="py-2 pr-3">{currency(entry.totalSocialSecurityPayment)}</td>
                  <td className="py-2 pr-3">{currency(entry.employerSocialSecurityCost)}</td>
                  <td className="py-2 pr-3">{currency(entry.benefits)}</td>
                  <td className="py-2 font-semibold">{currency(entry.employerCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-7 grid gap-x-8 lg:grid-cols-3">
          <div>
            <h3 className="mb-2 font-bold text-[#001F3F]">NÓMINA</h3>
            <TotalRow label="Total salarios" value={period.totals.salaries} />
            <TotalRow label="Total extras y recargos" value={period.totals.extras} />
            <TotalRow label="Total auxilios" value={period.totals.transportAid} />
            <TotalRow label="Total devengado" value={period.totals.totalAccrued} />
            <TotalRow label="Total deducciones" value={period.totals.totalDeductions} />
            <TotalRow label="Neto total empleados" value={period.totals.net} strong />
          </div>
          <div>
            <h3 className="mb-2 font-bold text-[#001F3F]">SEGURIDAD SOCIAL</h3>
            <TotalRow label="Salud trabajador 4%" value={employeeHealth} />
            <TotalRow label="Salud empresa 8,5%" value={employerHealth} />
            <TotalRow label="Total salud" value={totalHealth} />
            <TotalRow label="Pensión trabajador 4%" value={employeePension} />
            <TotalRow label="Pensión empresa 12%" value={employerPension} />
            <TotalRow label="Total pensión" value={totalPension} />
            <TotalRow label="ARL empresa" value={employerArl} />
            <TotalRow label="TOTAL SEGURIDAD SOCIAL A GIRAR" value={period.totals.totalSocialSecurityPayment} strong />
            <TotalRow label="APORTES ADICIONALES EMPRESA" value={period.totals.employerSocialSecurityCost} strong />
            <TotalRow label="SALIDA INMEDIATA DE NÓMINA" value={period.totals.immediatePayrollCashOutflow} strong />
          </div>
          <div>
            <h3 className="mb-2 font-bold text-[#001F3F]">PROVISIONES Y COSTO</h3>
            <TotalRow label="Total prima" value={prima} />
            <TotalRow label="Total cesantías" value={severance} />
            <TotalRow label="Total intereses de cesantías" value={severanceInterest} />
            <TotalRow label="Total vacaciones" value={vacation} />
            <TotalRow label="Total provisiones" value={period.totals.benefits} />
            <TotalRow label="COSTO LABORAL ESTIMADO DEL RESTAURANTE" value={period.totals.employerCost} strong />
          </div>
        </section>

        <p className="mt-5 text-xs text-slate-500">
          El total de seguridad social a girar incluye los descuentos del trabajador y los aportes de la empresa. El costo laboral estimado suma únicamente los aportes adicionales del empleador para evitar duplicar las deducciones del trabajador.
        </p>

        <div className="no-print mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">Cerrar</button>
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-[#001F3F] px-4 py-2 font-semibold text-white">
            Imprimir informe / Guardar PDF
          </button>
        </div>
      </article>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .payroll-cost-report, .payroll-cost-report * { visibility: visible !important; }
          .payroll-cost-report { position: absolute; inset: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
