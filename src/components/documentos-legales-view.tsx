'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ApiError,
  fetchLegalDocuments,
  fetchSellerTermsAudit,
  publishLegalDocument,
  setLegalDocumentCurrent,
} from '@/lib/api';
import type { LegalDocumentRow } from '@/lib/types';

type Tab = 'documents' | 'publish' | 'audit';

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'seller_program', label: 'Términos vendedores', view: 'terminosVendedores.hbs' },
  { value: 'terms_general', label: 'Términos generales', view: 'terminos.hbs' },
  { value: 'privacy_policy', label: 'Política privacidad', view: 'politicasPrivacidad.hbs' },
];

const emptyPublish = {
  documentType: 'seller_program',
  version: '',
  title: '',
  viewFileName: 'terminosVendedores.hbs',
  changeSummary: '',
  requiresReacceptance: true,
  makeCurrent: true,
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function typeLabel(documentType: string) {
  return DOCUMENT_TYPE_OPTIONS.find((o) => o.value === documentType)?.label || documentType;
}

export function DocumentosLegalesView() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('documents');
  const [filterType, setFilterType] = useState('');
  const [publishForm, setPublishForm] = useState(emptyPublish);
  const [error, setError] = useState<string | null>(null);
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');

  const listQuery = useQuery({
    queryKey: ['legal-documents', filterType],
    queryFn: () => fetchLegalDocuments(filterType || undefined),
  });

  const auditQuery = useQuery({
    queryKey: ['legal-audit', auditFrom, auditTo],
    queryFn: () =>
      fetchSellerTermsAudit({
        fromDate: auditFrom || undefined,
        toDate: auditTo || undefined,
        limit: 100,
      }),
    enabled: tab === 'audit',
  });

  const documents = listQuery.data?.data?.documents ?? [];
  const currentByType = listQuery.data?.data?.currentByType ?? {};
  const audit = auditQuery.data?.data;

  const grouped = useMemo(() => {
    const map = new Map<string, LegalDocumentRow[]>();
    for (const doc of documents) {
      const list = map.get(doc.documentType) || [];
      list.push(doc);
      map.set(doc.documentType, list);
    }
    return [...map.entries()];
  }, [documents]);

  const publishMutation = useMutation({
    mutationFn: () =>
      publishLegalDocument({
        documentType: publishForm.documentType,
        version: publishForm.version.trim(),
        title: publishForm.title.trim() || undefined,
        viewFileName: publishForm.viewFileName.trim() || undefined,
        changeSummary: publishForm.changeSummary.trim() || undefined,
        requiresReacceptance: publishForm.requiresReacceptance,
        makeCurrent: publishForm.makeCurrent,
      }),
    onSuccess: async () => {
      setError(null);
      setPublishForm((f) => ({ ...emptyPublish, documentType: f.documentType, viewFileName: f.viewFileName }));
      await queryClient.invalidateQueries({ queryKey: ['legal-documents'] });
      setTab('documents');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo publicar'),
  });

  const currentMutation = useMutation({
    mutationFn: (id: string) => setLegalDocumentCurrent(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['legal-documents'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo marcar vigente'),
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'documents', label: 'Versiones' },
    { id: 'publish', label: 'Publicar' },
    { id: 'audit', label: 'Auditoría vendedores' },
  ];

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Documentos legales</h1>
        <p className="mt-1 text-sm text-slate-500">
          Versiones, publicación y auditoría (antes en Cuenta de la app móvil).
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

      {tab === 'documents' ? (
        <div className="space-y-4">
          <label className="inline-flex items-center gap-2 text-sm text-slate-400">
            Filtrar tipo
            <select
              className="rounded-lg border border-white/10 bg-[#111827] px-3 py-1.5 text-slate-200"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">Todos</option>
              {DOCUMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {listQuery.isLoading ? <p className="text-sm text-slate-500">Cargando…</p> : null}
          {listQuery.isError ? (
            <p className="text-sm text-red-400">
              {(listQuery.error as Error)?.message || 'Error al cargar'}
            </p>
          ) : null}

          {grouped.map(([type, docs]) => (
            <section key={type} className="rounded-xl border border-white/10 bg-[#111827]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                <h2 className="font-semibold text-slate-100">{typeLabel(type)}</h2>
                <span className="text-xs text-slate-500">
                  Vigente: {currentByType[type]?.version || '—'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Versión</th>
                      <th className="px-4 py-2">Título</th>
                      <th className="px-4 py-2">Publicado</th>
                      <th className="px-4 py-2">Estado</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((doc) => (
                      <tr key={doc.id} className="border-t border-white/5">
                        <td className="px-4 py-3 font-medium text-slate-200">{doc.version}</td>
                        <td className="px-4 py-3 text-slate-400">{doc.title || '—'}</td>
                        <td className="px-4 py-3 text-slate-400">{formatDate(doc.publishedAt)}</td>
                        <td className="px-4 py-3">
                          {doc.isCurrent ? (
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                              vigente
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">histórica</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!doc.isCurrent ? (
                            <button
                              type="button"
                              disabled={currentMutation.isPending}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `¿Marcar ${doc.version} como vigente para ${typeLabel(type)}?`,
                                  )
                                ) {
                                  currentMutation.mutate(doc.id);
                                }
                              }}
                              className="rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300"
                            >
                              Hacer vigente
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {tab === 'publish' ? (
        <form
          className="max-w-xl space-y-3 rounded-xl border border-white/10 bg-[#111827] p-5"
          onSubmit={(e) => {
            e.preventDefault();
            publishMutation.mutate();
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-slate-400">Tipo</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
              value={publishForm.documentType}
              onChange={(e) => {
                const opt = DOCUMENT_TYPE_OPTIONS.find((o) => o.value === e.target.value);
                setPublishForm((f) => ({
                  ...f,
                  documentType: e.target.value,
                  viewFileName: opt?.view || f.viewFileName,
                }));
              }}
            >
              {DOCUMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-slate-400">Versión</span>
            <input
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
              value={publishForm.version}
              onChange={(e) => setPublishForm((f) => ({ ...f, version: e.target.value }))}
              placeholder="1.2.0"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-slate-400">Título (opcional)</span>
            <input
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
              value={publishForm.title}
              onChange={(e) => setPublishForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-slate-400">Vista HBS</span>
            <input
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
              value={publishForm.viewFileName}
              onChange={(e) => setPublishForm((f) => ({ ...f, viewFileName: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-slate-400">Resumen del cambio</span>
            <textarea
              className="min-h-24 w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
              value={publishForm.changeSummary}
              onChange={(e) => setPublishForm((f) => ({ ...f, changeSummary: e.target.value }))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={publishForm.requiresReacceptance}
              onChange={(e) =>
                setPublishForm((f) => ({ ...f, requiresReacceptance: e.target.checked }))
              }
            />
            Requiere nueva aceptación
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={publishForm.makeCurrent}
              onChange={(e) => setPublishForm((f) => ({ ...f, makeCurrent: e.target.checked }))}
            />
            Marcar como vigente al publicar
          </label>
          <button
            type="submit"
            disabled={publishMutation.isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {publishMutation.isPending ? 'Publicando…' : 'Publicar versión'}
          </button>
        </form>
      ) : null}

      {tab === 'audit' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <label className="text-sm text-slate-400">
              Desde
              <input
                type="date"
                className="ml-2 rounded-lg border border-white/10 bg-[#111827] px-3 py-1.5 text-slate-200"
                value={auditFrom}
                onChange={(e) => setAuditFrom(e.target.value)}
              />
            </label>
            <label className="text-sm text-slate-400">
              Hasta
              <input
                type="date"
                className="ml-2 rounded-lg border border-white/10 bg-[#111827] px-3 py-1.5 text-slate-200"
                value={auditTo}
                onChange={(e) => setAuditTo(e.target.value)}
              />
            </label>
          </div>

          {auditQuery.isLoading ? <p className="text-sm text-slate-500">Cargando auditoría…</p> : null}
          {auditQuery.isError ? (
            <p className="text-sm text-red-400">
              {(auditQuery.error as Error)?.message || 'Error en auditoría'}
            </p>
          ) : null}

          {audit ? (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-white/10 px-3 py-1 text-slate-400">
                  Ready: {String(audit.ready)}
                </span>
                {audit.summary ? (
                  <>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-slate-400">
                      Aceptaciones: {audit.summary.totalAcceptances ?? '—'}
                    </span>
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-200">
                      Pendientes: {audit.summary.pendingReacceptanceCount ?? '—'}
                    </span>
                  </>
                ) : null}
              </div>

              <section className="overflow-x-auto rounded-xl border border-white/10">
                <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-slate-200">
                  Aceptaciones recientes
                </h2>
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Fecha</th>
                      <th className="px-4 py-2">Seller</th>
                      <th className="px-4 py-2">Versión</th>
                      <th className="px-4 py-2">Plataforma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(audit.acceptances || []).slice(0, 50).map((row, idx) => (
                      <tr key={row.id || idx} className="border-t border-white/5">
                        <td className="px-4 py-2 text-slate-400">{formatDate(row.acceptedAt)}</td>
                        <td className="px-4 py-2 text-slate-300">
                          {row.sellerName || row.sellerEmail || row.sellerId || '—'}
                        </td>
                        <td className="px-4 py-2 text-slate-400">{row.documentVersion || '—'}</td>
                        <td className="px-4 py-2 text-slate-400">{row.platform || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="overflow-x-auto rounded-xl border border-white/10">
                <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-slate-200">
                  Vendedores pendientes
                </h2>
                <ul className="divide-y divide-white/5">
                  {(audit.pendingSellers || []).slice(0, 50).map((row) => (
                    <li key={row.id || row.email} className="px-4 py-3 text-sm text-slate-300">
                      {row.name || '—'} · {row.email || row.id}
                    </li>
                  ))}
                  {(audit.pendingSellers || []).length === 0 ? (
                    <li className="px-4 py-3 text-sm text-slate-500">Sin pendientes</li>
                  ) : null}
                </ul>
              </section>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
