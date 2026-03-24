import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export default function Button({
  variant = 'primary',
  children,
  className = '',
  ...props
}: Readonly<ButtonProps>) {

  const base =
    "px-4 py-2 text-sm rounded-lg font-medium transition-all duration-200";

  const styles =
    variant === 'primary'
      ? 'bg-[#001F3F] text-white hover:bg-[#003366] shadow-md hover:shadow-lg'
      : variant === 'danger'
      ? 'bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-lg'
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











































































































