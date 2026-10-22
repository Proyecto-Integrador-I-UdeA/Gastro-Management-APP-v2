import {
  dateRangePresets,
  detectPreset,
  type DateRangePreset,
} from '@/utils/finance/dateRanges';

type Props = {
  from: string;
  to: string;
  onApply: (range: { from: string; to: string }) => void;
};

const labels: Record<DateRangePreset, string> = {
  hoy: 'Hoy',
  ayer: 'Ayer',
  mesActual: 'Mes actual',
  mesAnterior: 'Mes anterior',
  ytd: 'Año en curso',
};

const order: DateRangePreset[] = ['hoy', 'ayer', 'mesActual', 'mesAnterior', 'ytd'];

export default function DatePresets({ from, to, onApply }: Props) {
  const active = detectPreset({ from, to });

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Rangos predefinidos">
      {order.map(preset => {
        const isActive = active === preset;
        return (
          <button
            key={preset}
            type="button"
            onClick={() => onApply(dateRangePresets[preset]())}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              isActive
                ? 'border-[#001F3F] bg-[#001F3F] text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-[#001F3F]'
            }`}
          >
            {labels[preset]}
          </button>
        );
      })}
    </div>
  );
}