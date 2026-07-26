export type AdminToastTone = 'error' | 'success' | 'info' | 'warning';

export type AdminToast = {
  id: string;
  tone: AdminToastTone;
  title: string;
  message: string;
  /** Texto completo para copiar (incluye título, mensaje, detalle técnico). */
  copyText: string;
  detail?: string | null;
  createdAt: number;
};

type Listener = (toasts: AdminToast[]) => void;

const MAX_TOASTS = 4;
const listeners = new Set<Listener>();
let toasts: AdminToast[] = [];

function emit() {
  const snapshot = [...toasts];
  for (const listener of listeners) listener(snapshot);
}

function nextId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function subscribeAdminToasts(listener: Listener) {
  listeners.add(listener);
  listener([...toasts]);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissAdminToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function clearAdminToasts() {
  toasts = [];
  emit();
}

function pushToast(input: Omit<AdminToast, 'id' | 'createdAt' | 'copyText'> & { copyText?: string }) {
  const copyText =
    input.copyText ||
    [input.title, input.message, input.detail].filter(Boolean).join('\n');
  const toast: AdminToast = {
    id: nextId(),
    tone: input.tone,
    title: input.title,
    message: input.message,
    detail: input.detail ?? null,
    copyText,
    createdAt: Date.now(),
  };
  toasts = [toast, ...toasts].slice(0, MAX_TOASTS);
  emit();
  return toast.id;
}

export function formatCaughtError(err: unknown): {
  message: string;
  detail: string | null;
  copyText: string;
} {
  if (err && typeof err === 'object' && 'message' in err) {
    const e = err as {
      message?: string;
      status?: number;
      hint?: string;
      name?: string;
      stack?: string;
    };
    const message = String(e.message || 'Error desconocido');
    const parts = [
      `Error: ${message}`,
      e.status != null ? `HTTP: ${e.status}` : null,
      e.hint ? `Hint: ${e.hint}` : null,
      e.name ? `Tipo: ${e.name}` : null,
      `Fecha: ${new Date().toISOString()}`,
      e.stack ? `Stack:\n${e.stack}` : null,
    ].filter(Boolean);
    return {
      message,
      detail: e.hint || (e.status != null ? `HTTP ${e.status}` : null),
      copyText: parts.join('\n'),
    };
  }
  const message = String(err ?? 'Error desconocido');
  return {
    message,
    detail: null,
    copyText: `Error: ${message}\nFecha: ${new Date().toISOString()}`,
  };
}

export function toastError(
  title: string,
  errOrMessage?: unknown,
  opts?: { detail?: string | null },
) {
  if (typeof errOrMessage === 'string' || errOrMessage == null) {
    const message = String(errOrMessage || title);
    const detail = opts?.detail ?? null;
    return pushToast({
      tone: 'error',
      title,
      message: errOrMessage == null ? title : message,
      detail,
      copyText: [title, message !== title ? message : null, detail, `Fecha: ${new Date().toISOString()}`]
        .filter(Boolean)
        .join('\n'),
    });
  }
  const formatted = formatCaughtError(errOrMessage);
  return pushToast({
    tone: 'error',
    title,
    message: formatted.message,
    detail: opts?.detail ?? formatted.detail,
    copyText: [`${title}`, formatted.copyText].join('\n'),
  });
}

export function toastSuccess(title: string, message?: string) {
  return pushToast({
    tone: 'success',
    title,
    message: message || title,
    detail: null,
  });
}

export function toastWarning(title: string, message?: string, detail?: string | null) {
  return pushToast({
    tone: 'warning',
    title,
    message: message || title,
    detail: detail ?? null,
  });
}

export function toastInfo(title: string, message?: string) {
  return pushToast({
    tone: 'info',
    title,
    message: message || title,
    detail: null,
  });
}
