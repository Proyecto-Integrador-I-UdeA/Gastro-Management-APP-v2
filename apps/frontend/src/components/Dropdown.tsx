
interface DropdownProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string | number; label: string }[];
}

export default function Dropdown({ label, error, options, ...props }: DropdownProps) {
  return (
    <div className="flex flex-col">
      <label className="mb-1 text-sm font-medium text-gray-700">{label}</label>
      <select
        className="border border-gray-300 rounded-md p-3 focus:ring-[#001F3F] focus:border-[#001F3F]"
        {...props}
      >
        <option value="">Seleccione</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}