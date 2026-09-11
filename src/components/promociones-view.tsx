'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ApiError,
  fetchPromoIosCatalog,
  fetchPromoOverview,
  fetchPromoPlayCatalog,
  upsertPromoCampaign,
  upsertPromoCode,
  upsertPromoSeller,
} from '@/lib/api';
import type { PromoCampaignRow, PromoCodeRow, PromoSellerRow } from '@/lib/types';

type Tab = 'sellers' | 'codes' | 'offers';

const emptySeller = {
  id: '' as string,
  name: '',
  email: '',
  phone: '',
  country: '',
  payoutAccountNumber: '',
  commissionRate: '20',
  status: 'active',
};

const emptyCode = {
  id: '' as string,
  code: '',
  sellerId: '',
  campaignIds: [] as string[],
  maxUses: '',
  maxUsesPerUser: '1',
  status: 'active',
  expiresAt: '',
};

const emptyOffer = {
  id: '' as string,
  name: '',
  description: '',
  discountLabel: '',
  platform: 'android',
  androidProductId: '',
  androidOfferTag: '',
  androidOfferToken: '',
  iosProductId: '',
  iosOfferId: '',
  status: 'active',
};

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40);
}

export function PromocionesView() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('sellers');
  const [error, setError] = useState<string | null>(null);
  const [sellerForm, setSellerForm] = useState(emptySeller);
  const [codeForm, setCodeForm] = useState(emptyCode);
  const [offerForm, setOfferForm] = useState(emptyOffer);
  const [catalogMsg, setCatalogMsg] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['promociones'],
    queryFn: fetchPromoOverview,
  });

  const sellers = query.data?.data?.sellers ?? [];
  const campaigns = query.data?.data?.campaigns ?? [];
  const allCodes = useMemo(
    () =>
      sellers.flatMap((s) =>
        (s.promoCodes || []).map((c) => ({ ...c, sellerName: s.name })),
      ),
    [sellers],
  );

  const selectableCampaigns = useMemo(
    () => campaigns.filter((c) => c.status !== 'inactive'),
    [campaigns],
  );

  const sellerMutation = useMutation({
    mutationFn: () =>
      upsertPromoSeller({
        id: sellerForm.id || undefined,
        name: sellerForm.name,
        email: sellerForm.email || undefined,
        phone: sellerForm.phone || undefined,
        country: sellerForm.country || undefined,
        payoutAccountNumber: sellerForm.payoutAccountNumber || undefined,
        commissionRate: sellerForm.commissionRate === '' ? null : Number(sellerForm.commissionRate),
        status: sellerForm.status as PromoSellerRow['status'],
      }),
    onSuccess: async () => {
      setSellerForm(emptySeller);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['promociones'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Error guardando vendedor'),
  });

  const codeMutation = useMutation({
    mutationFn: () =>
      upsertPromoCode({
        id: codeForm.id || undefined,
        code: codeForm.code,
        sellerId: codeForm.sellerId,
        campaignIds: codeForm.campaignIds,
        maxUses: codeForm.maxUses === '' ? null : Number(codeForm.maxUses),
        maxUsesPerUser: Number(codeForm.maxUsesPerUser || 1),
        status: codeForm.status as PromoCodeRow['status'],
        expiresAt: codeForm.expiresAt || null,
      }),
    onSuccess: async () => {
      setCodeForm(emptyCode);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['promociones'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Error guardando código'),
  });

  const offerMutation = useMutation({
    mutationFn: () =>
      upsertPromoCampaign({
        id: offerForm.id || undefined,
        name: offerForm.name,
        description: offerForm.description || undefined,
        discountLabel: offerForm.discountLabel || undefined,
        platform: offerForm.platform,
        androidProductId: offerForm.androidProductId || undefined,
        androidOfferTag: offerForm.androidOfferTag || undefined,
        androidOfferToken: offerForm.androidOfferToken || undefined,
        iosProductId: offerForm.iosProductId || undefined,
        iosOfferId: offerForm.iosOfferId || undefined,
        status: offerForm.status as PromoCampaignRow['status'],
      }),
    onSuccess: async () => {
      setOfferForm(emptyOffer);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['promociones'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Error guardando oferta'),
  });

  async function loadCatalog(kind: 'play' | 'ios') {
    setCatalogMsg(null);
    try {
      const res = kind === 'play' ? await fetchPromoPlayCatalog() : await fetchPromoIosCatalog();
      const count =
        kind === 'play'
          ? Array.isArray((res.data as { offers?: unknown[] })?.offers)
            ? (res.data as { offers: unknown[] }).offers.length
            : 0
          : Array.isArray((res.data as { products?: unknown[] })?.products)
            ? (res.data as { products: unknown[] }).products.length
            : 0;
      setCatalogMsg(
        kind === 'play'
          ? `Catálogo Play OK (${count} ofertas).`
          : `Catálogo iOS OK (${count} productos).`,
      );
    } catch (err) {
      setCatalogMsg(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo');
    }
  }

  function editSeller(row: PromoSellerRow) {
    setTab('sellers');
    setSellerForm({
      id: row.id,
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      country: row.country || '',
      payoutAccountNumber: row.payoutAccountNumber || '',
      commissionRate: row.commissionRate == null ? '' : String(row.commissionRate),
      status: row.status === 'inactive' ? 'inactive' : 'active',
    });
  }

  function editCode(row: PromoCodeRow & { sellerName?: string }) {
    setTab('codes');
    setCodeForm({
      id: row.id,
      code: row.code || '',
      sellerId: row.sellerId || '',
      campaignIds: row.campaignIds?.length ? row.campaignIds : row.campaignId ? [row.campaignId] : [],
      maxUses: row.maxUses == null ? '' : String(row.maxUses),
      maxUsesPerUser: String(row.maxUsesPerUser ?? 1),
      status: row.status === 'inactive' ? 'inactive' : 'active',
      expiresAt: row.expiresAt ? String(row.expiresAt).slice(0, 10) : '',
    });
  }

  function editOffer(row: PromoCampaignRow) {
    setTab('offers');
    setOfferForm({
      id: row.id,
      name: row.name || '',
      description: row.description || '',
      discountLabel: row.discountLabel || '',
      platform: row.platform === 'ios' ? 'ios' : 'android',
      androidProductId: row.androidProductId || '',
      androidOfferTag: row.androidOfferTag || '',
      androidOfferToken: row.androidOfferToken || '',
      iosProductId: row.iosProductId || '',
      iosOfferId: row.iosOfferId || '',
      status: ['draft', 'active', 'inactive'].includes(String(row.status))
        ? String(row.status)
        : 'active',
    });
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'sellers', label: 'Vendedores' },
    { id: 'codes', label: 'Códigos' },
    { id: 'offers', label: 'Ofertas tienda' },
  ];

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Vendedores y códigos</h1>
        <p className="mt-1 text-sm text-slate-500">
          CMS de vendedores, códigos promocionales y ofertas de tienda (antes en la app móvil).
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? 'bg-indigo-600 text-white'
                : 'border border-white/10 text-slate-400 hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      {query.isLoading ? <p className="text-sm text-slate-500">Cargando…</p> : null}
      {query.isError ? (
        <p className="text-sm text-red-400">
          {(query.error as Error)?.message || 'Error al cargar'}
        </p>
      ) : null}

      {tab === 'sellers' ? (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <form
            className="space-y-3 rounded-xl border border-white/10 bg-[#111827] p-4"
            onSubmit={(e) => {
              e.preventDefault();
              sellerMutation.mutate();
            }}
          >
            <h2 className="font-semibold text-slate-100">
              {sellerForm.id ? 'Editar vendedor' : 'Nuevo vendedor'}
            </h2>
            {(
              [
                ['name', 'Nombre'],
                ['email', 'Email'],
                ['phone', 'Teléfono'],
                ['country', 'País'],
                ['payoutAccountNumber', 'Cuenta pago'],
                ['commissionRate', 'Comisión %'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="mb-1 block text-xs text-slate-400">{label}</span>
                <input
                  className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                  value={sellerForm[key]}
                  onChange={(e) => setSellerForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </label>
            ))}
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-400">Estado</span>
              <select
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                value={sellerForm.status}
                onChange={(e) => setSellerForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={sellerMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Guardar
              </button>
              {sellerForm.id ? (
                <button
                  type="button"
                  onClick={() => setSellerForm(emptySeller)}
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300"
                >
                  Limpiar
                </button>
              ) : null}
            </div>
          </form>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Comisión</th>
                  <th className="px-4 py-3">Códigos</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sellers.map((row) => (
                  <tr key={row.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-slate-200">{row.name}</td>
                    <td className="px-4 py-3 text-slate-400">{row.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{row.commissionRate ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{row.promoCodes?.length || 0}</td>
                    <td className="px-4 py-3 text-slate-400">{row.status}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => editSeller(row)}
                        className="rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'codes' ? (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <form
            className="space-y-3 rounded-xl border border-white/10 bg-[#111827] p-4"
            onSubmit={(e) => {
              e.preventDefault();
              codeMutation.mutate();
            }}
          >
            <h2 className="font-semibold text-slate-100">
              {codeForm.id ? 'Editar código' : 'Nuevo código'}
            </h2>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-400">Código</span>
              <input
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                value={codeForm.code}
                onChange={(e) => setCodeForm((f) => ({ ...f, code: normalizeCode(e.target.value) }))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-400">Vendedor</span>
              <select
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                value={codeForm.sellerId}
                onChange={(e) => setCodeForm((f) => ({ ...f, sellerId: e.target.value }))}
              >
                <option value="">Seleccionar</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="space-y-1">
              <legend className="mb-1 text-xs text-slate-400">Ofertas asociadas</legend>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
                {selectableCampaigns.map((c) => {
                  const checked = codeForm.campaignIds.includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setCodeForm((f) => ({
                            ...f,
                            campaignIds: checked
                              ? f.campaignIds.filter((id) => id !== c.id)
                              : [...f.campaignIds, c.id],
                          }))
                        }
                      />
                      <span>
                        {c.name} · {c.platform}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-400">Máx usos (vacío = ilimitado)</span>
              <input
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                value={codeForm.maxUses}
                onChange={(e) => setCodeForm((f) => ({ ...f, maxUses: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-400">Máx por usuario</span>
              <input
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                value={codeForm.maxUsesPerUser}
                onChange={(e) => setCodeForm((f) => ({ ...f, maxUsesPerUser: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-400">Expira</span>
              <input
                type="date"
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                value={codeForm.expiresAt}
                onChange={(e) => setCodeForm((f) => ({ ...f, expiresAt: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-400">Estado</span>
              <select
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                value={codeForm.status}
                onChange={(e) => setCodeForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={codeMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Guardar
              </button>
              {codeForm.id ? (
                <button
                  type="button"
                  onClick={() => setCodeForm(emptyCode)}
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300"
                >
                  Limpiar
                </button>
              ) : null}
            </div>
          </form>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3">Ofertas</th>
                  <th className="px-4 py-3">Usos</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {allCodes.map((row) => (
                  <tr key={row.id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-medium text-slate-200">{row.code}</td>
                    <td className="px-4 py-3 text-slate-400">{row.sellerName}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {row.campaignIds?.length || (row.campaignId ? 1 : 0)}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {row.currentUses ?? 0}
                      {row.maxUses != null ? ` / ${row.maxUses}` : ''}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{row.status}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => editCode(row)}
                        className="rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'offers' ? (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <form
            className="space-y-3 rounded-xl border border-white/10 bg-[#111827] p-4"
            onSubmit={(e) => {
              e.preventDefault();
              offerMutation.mutate();
            }}
          >
            <h2 className="font-semibold text-slate-100">
              {offerForm.id ? 'Editar oferta' : 'Nueva oferta'}
            </h2>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-400">Nombre</span>
              <input
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                value={offerForm.name}
                onChange={(e) => setOfferForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-400">Plataforma</span>
              <select
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                value={offerForm.platform}
                onChange={(e) => setOfferForm((f) => ({ ...f, platform: e.target.value }))}
              >
                <option value="android">Android</option>
                <option value="ios">iOS</option>
              </select>
            </label>
            {offerForm.platform === 'android' ? (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-slate-400">Product ID</span>
                  <input
                    className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                    value={offerForm.androidProductId}
                    onChange={(e) =>
                      setOfferForm((f) => ({ ...f, androidProductId: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-slate-400">Offer tag</span>
                  <input
                    className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                    value={offerForm.androidOfferTag}
                    onChange={(e) =>
                      setOfferForm((f) => ({ ...f, androidOfferTag: e.target.value }))
                    }
                  />
                </label>
              </>
            ) : (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-slate-400">Product ID</span>
                  <input
                    className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                    value={offerForm.iosProductId}
                    onChange={(e) => setOfferForm((f) => ({ ...f, iosProductId: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-slate-400">Offer ID</span>
                  <input
                    className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                    value={offerForm.iosOfferId}
                    onChange={(e) => setOfferForm((f) => ({ ...f, iosOfferId: e.target.value }))}
                  />
                </label>
              </>
            )}
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-400">Etiqueta descuento</span>
              <input
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                value={offerForm.discountLabel}
                onChange={(e) => setOfferForm((f) => ({ ...f, discountLabel: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-400">Estado</span>
              <select
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                value={offerForm.status}
                onChange={(e) => setOfferForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={offerMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => loadCatalog('play')}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300"
              >
                Catálogo Play
              </button>
              <button
                type="button"
                onClick={() => loadCatalog('ios')}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300"
              >
                Catálogo iOS
              </button>
            </div>
            {catalogMsg ? <p className="text-xs text-slate-400">{catalogMsg}</p> : null}
          </form>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Plataforma</th>
                  <th className="px-4 py-3">Producto / oferta</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((row) => (
                  <tr key={row.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-slate-200">{row.name}</td>
                    <td className="px-4 py-3 text-slate-400">{row.platform}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {row.platform === 'ios'
                        ? `${row.iosProductId || '—'} / ${row.iosOfferId || '—'}`
                        : `${row.androidProductId || '—'} / ${row.androidOfferTag || '—'}`}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{row.status}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => editOffer(row)}
                        className="rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
