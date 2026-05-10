import LandingPage from '@/components/landing/LandingPage';
import { landingContact } from '@/config/landingContact';

export const metadata = {
  title: `${landingContact.companyName} — Gestión para restaurantes`,
  description:
    'Software para inventario, proveedores y operaciones. Solicite una demo o contáctenos. Inicie sesión en la plataforma.',
};

export default function HomePage() {
  return <LandingPage />;
}
