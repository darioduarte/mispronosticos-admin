'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  ApiError,
  fetchPromoIosCatalog,
  fetchPromoOverview,
  fetchPromoPlayCatalog,
  fetchPromoSellerSales,
  upsertPromoCampaign,
  upsertPromoCode,
  upsertPromoSeller,
} from '@/lib/api';
import type {
  PromoCampaignRow,
  PromoCodeRow,
  PromoSellerRow,
  PromoSellerSaleRow,
} from '@/lib/types';

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
  const [sellerModalOpen, setSellerModalOpen] = useState(false);
  const [salesSeller, setSalesSeller] = useState<PromoSellerRow | null>(null);

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
    onSuccess: async (res) => {
      const saved = res?.data;
      if (saved?.id) {
        setSellerForm({
          id: saved.id,
          name: saved.name || '',
          email: saved.email || '',
          phone: saved.phone || '',
          country: saved.country || '',
          payoutAccountNumber: saved.payoutAccountNumber || '',
          commissionRate: saved.commissionRate == null ? '' : String(saved.commissionRate),
          status: saved.status === 'inactive' ? 'inactive' : 'active',
        });
        setCodeForm((current) => ({ ...emptyCode, sellerId: saved.id }));
      }
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['promociones'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Error guardando vendedor'),
  });

  const codeMutation = useMutation({
    mutationFn: (sellerId?: string) =>
      upsertPromoCode({
        id: codeForm.id || undefined,
        code: codeForm.code,
        sellerId: sellerId || codeForm.sellerId,
        campaignIds: codeForm.campaignIds,
        maxUses: codeForm.maxUses === '' ? null : Number(codeForm.maxUses),
        maxUsesPerUser: Number(codeForm.maxUsesPerUser || 1),
        status: codeForm.status as PromoCodeRow['status'],
        expiresAt: codeForm.expiresAt || null,
      }),
    onSuccess: async () => {
      setCodeForm((current) => ({ ...emptyCode, sellerId: current.sellerId }));
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
    setCodeForm({ ...emptyCode, sellerId: row.id });
    setError(null);
    setSellerModalOpen(true);
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

  const salesQuery = useQuery({
    queryKey: ['promociones', 'sales', salesSeller?.id],
    queryFn: () => fetchPromoSellerSales(salesSeller!.id),
    enabled: Boolean(salesSeller?.id),
  });

  const editingSeller = sellers.find((row) => row.id === sellerForm.id) || null;
  const editingCodes = editingSeller?.promoCodes || [];

  function openCreateSeller() {
    setTab('sellers');
    setSellerForm(emptySeller);
    setCodeForm(emptyCode);
    setError(null);
    setSellerModalOpen(true);
  }

  function openSellerSales(row: PromoSellerRow) {
    setSalesSeller(row);
  }

  function editSellerCode(row: PromoCodeRow) {
    setCodeForm({
      id: row.id,
      code: row.code || '',
      sellerId: sellerForm.id || row.sellerId || '',
      campaignIds: row.campaignIds?.length ? row.campaignIds : row.campaignId ? [row.campaignId] : [],
      maxUses: row.maxUses == null ? '' : String(row.maxUses),
      maxUsesPerUser: String(row.maxUsesPerUser ?? 1),
      status: row.status === 'inactive' ? 'inactive' : 'active',
      expiresAt: row.expiresAt ? String(row.expiresAt).slice(0, 10) : '',
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
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openCreateSeller}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Nuevo vendedor
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Comisión</th>
                  <th className="px-4 py-3">Códigos</th>
                  <th className="px-4 py-3">Ventas</th>
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
                    <td className="px-4 py-3">
                      <div className="text-slate-200">{row.sales?.salesCount ?? 0}</div>
                      {(row.sales?.pendingCount || 0) > 0 ? (
                        <div className="text-xs text-amber-300/80">
                          {row.sales?.pendingCount} sin convertir
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{row.status}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openSellerSales(row)}
                          className="rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300"
                        >
                          Ventas
                        </button>
                        <button
                          type="button"
                          onClick={() => editSeller(row)}
                          className="rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300"
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sellers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-slate-500">
                      No hay vendedores.
                    </td>
                  </tr>
                ) : null}
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
              codeMutation.mutate(undefined);
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

      {sellerModalOpen ? (
        <SellerEditorModal
          sellerForm={sellerForm}
          setSellerForm={setSellerForm}
          codeForm={codeForm}
          setCodeForm={setCodeForm}
          codes={editingCodes}
          campaigns={selectableCampaigns}
          savingSeller={sellerMutation.isPending}
          savingCode={codeMutation.isPending}
          error={error}
          onSaveSeller={() => sellerMutation.mutate()}
          onSaveCode={() => {
            if (!sellerForm.id) return;
            codeMutation.mutate(sellerForm.id);
          }}
          onEditCode={editSellerCode}
          onNewCode={() => setCodeForm({ ...emptyCode, sellerId: sellerForm.id })}
          onClose={() => setSellerModalOpen(false)}
        />
      ) : null}

      {salesSeller ? (
        <SellerSalesModal
          sellerName={salesQuery.data?.data.seller.name || salesSeller.name}
          loading={salesQuery.isLoading}
          error={
            salesQuery.isError
              ? (salesQuery.error as Error)?.message || 'No se pudieron cargar las ventas'
              : null
          }
          summary={salesQuery.data?.data.summary}
          sales={salesQuery.data?.data.sales || []}
          attempts={salesQuery.data?.data.attempts || []}
          onClose={() => setSalesSeller(null)}
        />
      ) : null}
    </div>
  );
}

type SellerFormState = typeof emptySeller;
type CodeFormState = typeof emptyCode;

function SellerEditorModal({
  sellerForm,
  setSellerForm,
  codeForm,
  setCodeForm,
  codes,
  campaigns,
  savingSeller,
  savingCode,
  error,
  onSaveSeller,
  onSaveCode,
  onEditCode,
  onNewCode,
  onClose,
}: {
  sellerForm: SellerFormState;
  setSellerForm: Dispatch<SetStateAction<SellerFormState>>;
  codeForm: CodeFormState;
  setCodeForm: Dispatch<SetStateAction<CodeFormState>>;
  codes: PromoCodeRow[];
  campaigns: PromoCampaignRow[];
  savingSeller: boolean;
  savingCode: boolean;
  error: string | null;
  onSaveSeller: () => void;
  onSaveCode: () => void;
  onEditCode: (row: PromoCodeRow) => void;
  onNewCode: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="seller-editor-title"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 id="seller-editor-title" className="text-lg font-semibold text-white">
              {sellerForm.id ? 'Editar vendedor' : 'Nuevo vendedor'}
            </h2>
            <p className="text-sm text-slate-400">Datos del vendedor y sus códigos promocionales.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-1 text-sm text-slate-400 hover:text-white"
          >
            Cerrar
          </button>
        </div>
        <div className="max-h-[75vh] space-y-6 overflow-auto p-5">
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSaveSeller();
            }}
          >
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
                  onChange={(e) => setSellerForm((current) => ({ ...current, [key]: e.target.value }))}
                />
              </label>
            ))}
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-400">Estado</span>
              <select
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                value={sellerForm.status}
                onChange={(e) => setSellerForm((current) => ({ ...current, status: e.target.value }))}
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={savingSeller}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Guardar vendedor
              </button>
            </div>
          </form>

          {sellerForm.id ? (
            <div className="space-y-4 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-100">Códigos promocionales</h3>
                <button
                  type="button"
                  onClick={onNewCode}
                  className="rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300"
                >
                  Nuevo código
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-white/5 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Usos</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((row) => (
                      <tr key={row.id} className="border-t border-white/5">
                        <td className="px-3 py-2 text-slate-200">{row.code}</td>
                        <td className="px-3 py-2 text-slate-400">
                          {row.currentUses ?? 0}
                          {row.maxUses != null ? ` / ${row.maxUses}` : ''}
                        </td>
                        <td className="px-3 py-2 text-slate-400">{row.status}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => onEditCode(row)}
                            className="rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {codes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-slate-500">
                          Este vendedor todavía no tiene códigos.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  onSaveCode();
                }}
              >
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-slate-400">Código</span>
                  <input
                    className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                    value={codeForm.code}
                    onChange={(e) =>
                      setCodeForm((current) => ({ ...current, code: normalizeCode(e.target.value) }))
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-slate-400">Máx usos (vacío = ilimitado)</span>
                  <input
                    className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                    value={codeForm.maxUses}
                    onChange={(e) => setCodeForm((current) => ({ ...current, maxUses: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-slate-400">Máx por usuario</span>
                  <input
                    className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                    value={codeForm.maxUsesPerUser}
                    onChange={(e) =>
                      setCodeForm((current) => ({ ...current, maxUsesPerUser: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-slate-400">Expira</span>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                    value={codeForm.expiresAt}
                    onChange={(e) => setCodeForm((current) => ({ ...current, expiresAt: e.target.value }))}
                  />
                </label>
                <fieldset className="space-y-1 sm:col-span-2">
                  <legend className="mb-1 text-xs text-slate-400">Ofertas asociadas</legend>
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
                    {campaigns.map((campaign) => {
                      const checked = codeForm.campaignIds.includes(campaign.id);
                      return (
                        <label key={campaign.id} className="flex items-center gap-2 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setCodeForm((current) => ({
                                ...current,
                                campaignIds: checked
                                  ? current.campaignIds.filter((id) => id !== campaign.id)
                                  : [...current.campaignIds, campaign.id],
                              }))
                            }
                          />
                          <span>
                            {campaign.name} · {campaign.platform}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={savingCode}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    {codeForm.id ? 'Guardar código' : 'Agregar código'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <p className="border-t border-white/10 pt-4 text-sm text-slate-400">
              Guarda el vendedor para poder agregar códigos promocionales.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSaleWhen(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

function saleStatusLabel(status: string) {
  if (status === 'pending') return 'comisión pendiente';
  if (status === 'approved') return 'aprobada';
  if (status === 'paid') return 'pagada';
  if (status === 'cancelled') return 'cancelada';
  if (status === 'converted') return 'convertida';
  if (status === 'expired') return 'expirada';
  return status;
}

function SellerSalesModal({
  sellerName,
  loading,
  error,
  summary,
  sales,
  attempts,
  onClose,
}: {
  sellerName: string;
  loading: boolean;
  error: string | null;
  summary?: {
    salesCount: number;
    pendingCount: number;
    cancelledCount: number;
    convertedCount: number;
  };
  sales: PromoSellerSaleRow[];
  attempts: PromoSellerSaleRow[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="seller-sales-title"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 id="seller-sales-title" className="text-lg font-semibold text-white">
              Ventas de {sellerName}
            </h2>
            <p className="text-sm text-slate-400">
              {summary
                ? `${summary.salesCount} ventas · ${summary.pendingCount} códigos sin convertir · ${summary.cancelledCount} cancelados`
                : 'Compras asociadas al código del vendedor.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-1 text-sm text-slate-400 hover:text-white"
          >
            Cerrar
          </button>
        </div>
        <div className="max-h-[75vh] space-y-6 overflow-auto p-5">
          {loading ? <p className="text-sm text-slate-400">Cargando ventas…</p> : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <section>
            <h3 className="mb-2 font-semibold text-slate-100">Ventas registradas</h3>
            <SalesTable
              rows={sales}
              emptyLabel="Todavía no hay ventas convertidas para este vendedor."
            />
          </section>
          <section>
            <h3 className="mb-2 font-semibold text-slate-100">Códigos aplicados sin compra</h3>
            <SalesTable
              rows={attempts}
              emptyLabel="No hay intentos pendientes ni cancelados."
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function SalesTable({ rows, emptyLabel }: { rows: PromoSellerSaleRow[]; emptyLabel: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Fecha</th>
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">Plataforma</th>
            <th className="px-3 py-2">Producto</th>
            <th className="px-3 py-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/5">
              <td className="px-3 py-2 text-slate-300">{formatSaleWhen(row.at)}</td>
              <td className="px-3 py-2 text-slate-200">{row.code || '—'}</td>
              <td className="px-3 py-2 text-slate-400">{row.platform || '—'}</td>
              <td className="px-3 py-2 text-slate-400">{row.productId || '—'}</td>
              <td className="px-3 py-2 text-slate-400">
                {saleStatusLabel(row.status)}
                {row.kind === 'sale' && row.linked === false ? ' · sin redención' : ''}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-4 text-slate-500">
                {emptyLabel}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
