import React from 'react';

// src/components/Button.tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export default function Button({
  variant = 'primary',
  children,
  className = '',
  ...props
}: Readonly<ButtonProps>) {
  const base = "px-6 py-3 rounded-md font-medium transition shadow-sm";
  const styles = variant === 'primary'
    ? 'bg-[#001F3F] text-white hover:bg-blue-900'
    : variant === 'danger'
    ? 'bg-red-600 text-white hover:bg-red-700'
    : 'bg-gray-200 text-gray-800 hover:bg-gray-300';

  return (
    <button
      className={`${base} ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}


















































































