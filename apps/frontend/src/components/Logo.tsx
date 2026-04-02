export default function Logo() {
  return (
    <div className="w-16 h-16 flex items-center justify-center">
      <img
        src="/images/logotipo.jpg"
        alt="Logo"
        width={60}
        height={60}
        className="object-contain"
      />
    </div>
  );
}