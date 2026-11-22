import type { FinancePayrollEntry } from "@/lib/financePayrollApi";

function currency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function Row({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-6 border-b border-slate-200 py-2 ${strong ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{currency(value)}</span>
    </div>
  );
}

export default function PayrollReceipt({
  month,
  entry,
  areaLabel,
  onClose,
}: {
  month: string;
  entry: FinancePayrollEntry;
  areaLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="payroll-receipt-overlay fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 print:static print:bg-white print:p-0">
      <article aria-label="Comprobante de nómina" className="payroll-receipt mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
        <header className="border-b-2 border-[#001F3F] pb-4 text-center">
          <p className="font-bold tracking-wide text-[#001F3F]">GASTRO MANAGEMENT APP</p>
          <h2 className="mt-1 text-2xl font-bold">COMPROBANTE DE NÓMINA</h2>
        </header>

        <dl className="mt-5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div><dt className="text-xs font-semibold uppercase text-slate-500">Período</dt><dd>{month}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-slate-500">Empleado</dt><dd>{entry.fullName}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-slate-500">Documento</dt><dd>{entry.nationalId}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-slate-500">Área</dt><dd>{areaLabel}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-slate-500">Cargo</dt><dd>{entry.position}</dd></div>
        </dl>

        <section className="mt-6">
          <h3 className="font-bold text-[#001F3F]">DEVENGADOS</h3>
          <Row label="Salario" value={entry.salary} />
          <Row label="Horas extra diurnas" value={entry.dayOvertimePay} />
          <Row label="Horas extra nocturnas" value={entry.nightOvertimePay} />
          <Row label="Recargo nocturno" value={entry.nightSurchargePay} />
          <Row label="Dominical/festivo diurno" value={entry.restDayDayPay} />
          <Row label="Dominical/festivo nocturno" value={entry.restDayNightPay} />
          <Row label="Auxilio de transporte" value={entry.transportAid} />
          <Row label="Total devengado" value={entry.totalAccrued} strong />
        </section>

        <section className="mt-6">
          <h3 className="font-bold text-[#001F3F]">DEDUCCIONES</h3>
          <Row label="Salud" value={entry.healthDeduction} />
          <Row label="Pensión" value={entry.pensionDeduction} />
          <Row label="Otros descuentos" value={entry.otherDeductions} />
          <Row label="Total deducciones" value={entry.totalDeductions} strong />
        </section>

        <div className="mt-7 rounded-xl bg-[#001F3F] p-4 text-white">
          <Row label="NETO A PAGAR" value={entry.net} strong />
        </div>

        <div className="no-print mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">Cerrar</button>
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-[#001F3F] px-4 py-2 font-semibold text-white">
            Imprimir / Guardar PDF
          </button>
        </div>
      </article>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .payroll-receipt, .payroll-receipt * { visibility: visible !important; }
          .payroll-receipt { position: absolute; inset: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
