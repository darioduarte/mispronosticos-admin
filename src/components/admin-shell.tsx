'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { clearSession, getStoredUser } from '@/lib/auth';
import { AdminToastHost } from '@/components/admin-toast-host';
import {
  activeNavGroupId,
  filterNavGroups,
  isActivePath,
  NAV_GROUPS,
} from '@/lib/admin-nav';

const OPEN_GROUPS_KEY = 'admin-nav-open-groups';

function defaultOpenGroups(pathname: string) {
  const active = activeNavGroupId(NAV_GROUPS, pathname);
  return active ? [active] : [];
}

function readOpenGroups(pathname: string) {
  const fallback = defaultOpenGroups(pathname);
  try {
    const raw = window.localStorage.getItem(OPEN_GROUPS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return fallback;
    const stored = parsed.filter((id): id is string => typeof id === 'string');
    const active = activeNavGroupId(NAV_GROUPS, pathname);
    if (active && !stored.includes(active)) stored.push(active);
    return stored;
  } catch {
    return fallback;
  }
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [openIds, setOpenIds] = useState<string[]>(() => defaultOpenGroups(pathname));
  const searching = query.trim().length > 0;
  const groups = useMemo(() => filterNavGroups(NAV_GROUPS, query), [query]);

  useEffect(() => {
    setOpenIds(readOpenGroups(pathname));
    setHydrated(true);
    // Solo al montar: después la ruta abre su grupo sin pisar lo que el usuario cerró.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const active = activeNavGroupId(NAV_GROUPS, pathname);
    if (!active) return;
    setOpenIds((current) => (current.includes(active) ? current : [...current, active]));
  }, [hydrated, pathname]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(openIds));
    } catch {
      /* el menú sigue funcionando si el navegador bloquea el almacenamiento */
    }
  }, [hydrated, openIds]);

  function toggleGroup(id: string) {
    setOpenIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <>
      <label className="mb-3 block">
        <span className="sr-only">Buscar opción del menú</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar opción"
          className="w-full rounded-2xl bg-[#1F2937] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
      </label>
      {groups.length === 0 ? (
        <p className="px-3 py-2 text-sm text-slate-500">Sin resultados</p>
      ) : (
        groups.map((group) => {
          const open = searching || openIds.includes(group.id);
          const headingClass =
            group.id === 'analisis-expertos' ? 'text-[#F2C94C]' : 'text-slate-500';
          return (
            <div key={group.id} className="mb-2">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                  if (!searching) toggleGroup(group.id);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left ${headingClass}`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  {group.label}
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  className={`shrink-0 transition ${open ? 'rotate-180' : ''}`}
                >
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {open ? (
                <div className="space-y-0.5 pb-1">
                  {group.items.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={`block rounded-2xl px-3 py-2 text-sm font-medium transition ${
                          active
                            ? 'bg-[#4CDEA8] text-[#052e16]'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getStoredUser();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentPage = useMemo(() => {
    for (const group of NAV_GROUPS) {
      const hit = group.items.find((item) => isActivePath(pathname, item.href));
      if (hit) return hit.label;
    }
    return 'Panel admin';
  }, [pathname]);

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
    <div className="flex min-h-screen bg-[#0B1120] text-slate-100">
      <aside className="hidden w-60 shrink-0 flex-col bg-[#111827] md:flex">
        <div className="px-4 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#4CDEA8]">
            Mis Pronósticos
          </p>
          <p className="mt-1 text-sm font-medium text-slate-300">Panel admin</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="p-4">
          {user && (
            <div className="mb-3 truncate text-xs text-slate-500">{user.email}</div>
          )}
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-2xl bg-[#1F2937] px-3 py-2 text-sm text-slate-300 transition hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-[#111827]/95 px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1F2937] text-slate-300 transition hover:text-white"
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

        {menuOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              aria-label="Cerrar menú"
              className="absolute inset-0 bg-black/60"
              onClick={() => setMenuOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-[min(100%,18rem)] flex-col bg-[#111827] shadow-2xl">
              <div className="px-4 py-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#4CDEA8]">
                  Mis Pronósticos
                </p>
                <p className="mt-1 text-sm font-medium text-slate-300">Panel admin</p>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
              </nav>
              <div className="p-4">
                {user && (
                  <div className="mb-3 truncate text-xs text-slate-500">{user.email}</div>
                )}
                <button
                  type="button"
                  onClick={logout}
                  className="w-full rounded-2xl bg-[#1F2937] px-3 py-2 text-sm text-slate-300 transition hover:text-white"
                >
                  Cerrar sesión
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <AdminToastHost />
    </div>
  );
}
