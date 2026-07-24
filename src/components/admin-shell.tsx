'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getStoredUser } from '@/lib/auth';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/monitoreo', label: 'Monitoreo' },
  { href: '/parametros-en-vivo', label: 'Parámetros en vivo' },
  { href: '/partidos', label: 'Partidos' },
  { href: '/ligas', label: 'Ligas' },
  { href: '/arbitros', label: 'Árbitros' },
  { href: '/pronosticos-ia', label: 'Pronósticos IA' },
  { href: '/suscripciones', label: 'Suscripciones' },
  { href: '/trials', label: 'Trials' },
  { href: '/sugerencias', label: 'Sugerencias' },
];

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              active
                ? 'bg-indigo-600/25 text-indigo-200'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getStoredUser();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentPage = NAV.find((item) => item.href === pathname)?.label ?? 'Panel admin';

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  return (
    <div className="flex min-h-screen bg-[#0b0f14] text-slate-100">
      {/* Sidebar desktop */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/10 bg-[#111827] md:flex">
        <div className="border-b border-white/10 px-4 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
            Mis Pronósticos
          </p>
          <p className="mt-1 text-sm font-medium text-slate-300">Panel admin</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="border-t border-white/10 p-4">
          {user && (
            <div className="mb-3 truncate text-xs text-slate-500">{user.email}</div>
          )}
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400 transition hover:border-white/20 hover:text-slate-200"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar móvil */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-[#111827]/95 px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/5"
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-100">{currentPage}</p>
            <p className="truncate text-xs text-slate-500">Mis Pronósticos · Admin</p>
          </div>
        </header>

        {/* Drawer móvil */}
        {menuOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              aria-label="Cerrar menú"
              className="absolute inset-0 bg-black/60"
              onClick={() => setMenuOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-[min(100%,18rem)] flex-col border-r border-white/10 bg-[#111827] shadow-2xl">
              <div className="border-b border-white/10 px-4 py-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                  Mis Pronósticos
                </p>
                <p className="mt-1 text-sm font-medium text-slate-300">Panel admin</p>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
              </nav>
              <div className="border-t border-white/10 p-4">
                {user && (
                  <div className="mb-3 truncate text-xs text-slate-500">{user.email}</div>
                )}
                <button
                  type="button"
                  onClick={logout}
                  className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400 transition hover:border-white/20 hover:text-slate-200"
                >
                  Cerrar sesión
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
