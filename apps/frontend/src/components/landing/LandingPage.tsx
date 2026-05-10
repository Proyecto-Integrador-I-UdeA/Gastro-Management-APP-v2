'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Mail, MapPin, Menu, Phone, PlayCircle, UtensilsCrossed, X } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { landingContact } from '@/config/landingContact';

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoName, setDemoName] = useState('');
  const [demoEmail, setDemoEmail] = useState('');
  const [demoCompany, setDemoCompany] = useState('');
  const [demoMessage, setDemoMessage] = useState('');

  const requestDemoMailto = useCallback(() => {
    const subject = encodeURIComponent(
      `Solicitud de demo — ${landingContact.companyName}`
    );
    const body = encodeURIComponent(
      [
        `Nombre: ${demoName || '—'}`,
        `Correo: ${demoEmail || '—'}`,
        `Empresa / restaurante: ${demoCompany || '—'}`,
        '',
        demoMessage || 'Me interesa conocer la plataforma.',
      ].join('\n')
    );
    window.location.href = `mailto:${landingContact.demoEmail}?subject=${subject}&body=${body}`;
  }, [demoName, demoEmail, demoCompany, demoMessage]);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <button
            type="button"
            onClick={() => scrollTo('top')}
            className="flex items-center gap-2 text-left font-semibold text-[#001F3F]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#001F3F] text-white">
              <UtensilsCrossed className="h-4 w-4" aria-hidden />
            </span>
            <span className="hidden sm:inline">{landingContact.companyName}</span>
          </button>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <button
              type="button"
              onClick={() => scrollTo('demo')}
              className="transition hover:text-[#001F3F]"
            >
              Solicitar demo
            </button>
            <button
              type="button"
              onClick={() => scrollTo('contacto')}
              className="transition hover:text-[#001F3F]"
            >
              Contáctenos
            </button>
            <Link
              href={ROUTES.login}
              className="rounded-lg bg-[#001F3F] px-4 py-2 text-white shadow-sm transition hover:bg-[#142a3b]"
            >
              Iniciar sesión
            </Link>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <Link
              href={ROUTES.login}
              className="rounded-lg bg-[#001F3F] px-3 py-2 text-sm font-medium text-white"
            >
              Entrar
            </Link>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-100 bg-white px-4 py-4 md:hidden">
            <div className="flex flex-col gap-3 text-sm font-medium">
              <button
                type="button"
                className="text-left py-2 text-slate-700"
                onClick={() => scrollTo('demo')}
              >
                Solicitar demo
              </button>
              <button
                type="button"
                className="text-left py-2 text-slate-700"
                onClick={() => scrollTo('contacto')}
              >
                Contáctenos
              </button>
            </div>
          </div>
        )}
      </header>

      <main id="top" className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#001F3F]/80">
              Software para restaurantes y cadena de suministro
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Gestione inventario, proveedores y operaciones en un solo lugar
            </h1>
            <p className="mt-6 text-lg text-slate-600">
              Centralice su catálogo, compras y reportes. Menos hojas de cálculo, más control en
              cocina y administración.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => scrollTo('demo')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-[#001F3F]/25 transition hover:bg-[#142a3b]"
              >
                <PlayCircle className="h-5 w-5" />
                Me interesa una demo
              </button>
              <Link
                href={ROUTES.login}
                className="inline-flex items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-base font-semibold text-[#001F3F] transition hover:border-[#001F3F]/30"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-100 bg-slate-50/80 py-14 md:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-3 md:px-6">
            {[
              {
                title: 'Inventario y bodegas',
                text: 'Stock, traslados y alertas para no quedarse sin insumos clave.',
              },
              {
                title: 'Proveedores y productos',
                text: 'Catálogo unificado y trazabilidad desde la compra al plato.',
              },
              {
                title: 'Reportes claros',
                text: 'Decisiones con datos: costos, riesgos y uso por categoría.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-[#001F3F]">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="demo" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 md:px-6 md:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-start">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">¿Le interesa ver la plataforma?</h2>
              <p className="mt-4 text-slate-600">
                Cuéntenos quién es usted y con gusto coordinamos una demostración adaptada a su
                operación. Puede usar el formulario y enviar el mensaje con su correo, o escribirnos
                directamente.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="text-[#001F3F]">•</span>
                  Recorrido por inventario, proveedores y reportes.
                </li>
                <li className="flex gap-2">
                  <span className="text-[#001F3F]">•</span>
                  Sin compromiso: evalúe si encaja con su equipo.
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md md:p-8">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  requestDemoMailto();
                }}
              >
                <div>
                  <label htmlFor="demo-name" className="mb-1 block text-sm font-medium text-slate-700">
                    Nombre
                  </label>
                  <input
                    id="demo-name"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[#001F3F] focus:border-[#001F3F] focus:ring-1"
                    value={demoName}
                    onChange={(e) => setDemoName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label htmlFor="demo-mail" className="mb-1 block text-sm font-medium text-slate-700">
                    Correo electrónico
                  </label>
                  <input
                    id="demo-mail"
                    type="email"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[#001F3F] focus:border-[#001F3F] focus:ring-1"
                    value={demoEmail}
                    onChange={(e) => setDemoEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label htmlFor="demo-company" className="mb-1 block text-sm font-medium text-slate-700">
                    Empresa o restaurante
                  </label>
                  <input
                    id="demo-company"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[#001F3F] focus:border-[#001F3F] focus:ring-1"
                    value={demoCompany}
                    onChange={(e) => setDemoCompany(e.target.value)}
                    autoComplete="organization"
                  />
                </div>
                <div>
                  <label htmlFor="demo-msg" className="mb-1 block text-sm font-medium text-slate-700">
                    Mensaje (opcional)
                  </label>
                  <textarea
                    id="demo-msg"
                    rows={3}
                    className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[#001F3F] focus:border-[#001F3F] focus:ring-1"
                    value={demoMessage}
                    onChange={(e) => setDemoMessage(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#001F3F] py-3 text-sm font-semibold text-white transition hover:bg-[#142a3b]"
                >
                  Enviar solicitud de demo
                </button>
                <p className="text-center text-xs text-slate-500">
                  Se abrirá su cliente de correo con el mensaje preparado. Si no ocurre, escríbanos a{' '}
                  <a className="font-medium text-[#001F3F] underline" href={`mailto:${landingContact.demoEmail}`}>
                    {landingContact.demoEmail}
                  </a>
                  .
                </p>
              </form>
            </div>
          </div>
        </section>

        <section
          id="contacto"
          className="border-t border-slate-100 bg-[#001F3F] py-16 text-white md:py-20 scroll-mt-24"
        >
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <h2 className="text-3xl font-bold">Contáctenos</h2>
            <p className="mt-3 max-w-2xl text-slate-300">
              Estamos disponibles para resolver dudas comerciales o de implementación.
            </p>
            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <a
                href={`mailto:${landingContact.email}`}
                className="flex gap-4 rounded-xl bg-white/10 p-5 transition hover:bg-white/15"
              >
                <Mail className="h-6 w-6 shrink-0 text-white" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-slate-200">Correo</p>
                  <p className="mt-1 break-all text-sm font-semibold">{landingContact.email}</p>
                </div>
              </a>
              <a
                href={`tel:${landingContact.phone.replace(/\s/g, '')}`}
                className="flex gap-4 rounded-xl bg-white/10 p-5 transition hover:bg-white/15"
              >
                <Phone className="h-6 w-6 shrink-0 text-white" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-slate-200">Teléfono</p>
                  <p className="mt-1 text-sm font-semibold">{landingContact.phone}</p>
                </div>
              </a>
              <div className="flex gap-4 rounded-xl bg-white/10 p-5 sm:col-span-2 lg:col-span-1">
                <MapPin className="h-6 w-6 shrink-0 text-white" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-slate-200">Ubicación</p>
                  <p className="mt-1 text-sm font-semibold">{landingContact.address}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        <div className="mx-auto max-w-6xl px-4">
          <p>
            © {new Date().getFullYear()} {landingContact.companyName}.{' '}
            <Link href={ROUTES.login} className="font-medium text-[#001F3F] hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
