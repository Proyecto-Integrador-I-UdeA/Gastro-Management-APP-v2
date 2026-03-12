
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export default function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  const base = "px-6 py-3 rounded-md font-medium transition";
  const styles = variant === 'primary'
    ? 'bg-green-600 text-white hover:bg-green-700'
    : 'bg-gray-200 text-gray-800 hover:bg-gray-300';

  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}