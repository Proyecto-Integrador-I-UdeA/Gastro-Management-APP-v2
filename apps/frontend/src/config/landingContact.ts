/** Datos públicos de la landing. Sustituir con NEXT_PUBLIC_* en .env si aplica. */
export const landingContact = {
  companyName: process.env.NEXT_PUBLIC_LANDING_COMPANY ?? 'Gastro Management',
  email: process.env.NEXT_PUBLIC_LANDING_EMAIL ?? 'contacto@gastromanagement.com',
  phone: process.env.NEXT_PUBLIC_LANDING_PHONE ?? '+57 300 000 0000',
  address: process.env.NEXT_PUBLIC_LANDING_ADDRESS ?? 'Medellín, Colombia',
  /** Destino de solicitudes de demo (mailto). Por defecto mismo correo que contacto. */
  demoEmail:
    process.env.NEXT_PUBLIC_LANDING_DEMO_EMAIL ??
    process.env.NEXT_PUBLIC_LANDING_EMAIL ??
    'contacto@gastromanagement.com',
} as const;
