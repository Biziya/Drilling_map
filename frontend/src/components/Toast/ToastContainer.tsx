import { dismissToast, useToasts } from './toastStore';
import type { Toast, ToastType } from './toastStore';

const TOAST_STYLES: Readonly<Record<ToastType, { icon: string; accent: string }>> = {
  success: { icon: '✓', accent: 'bg-green-600' },
  warning: { icon: '⚠', accent: 'bg-amber-500' },
  error: { icon: '✕', accent: 'bg-red-600' },
};

function ToastItem({ id, type, message, leaving }: Toast) {
  const { icon, accent } = TOAST_STYLES[type];

  return (
    <div
      // Errors interrupt; success and warnings wait for the screen reader.
      role={type === 'error' ? 'alert' : 'status'}
      data-type={type}
      className={`pointer-events-auto flex max-w-full items-center gap-2.5 rounded-lg border border-line bg-surface/95 py-1.5 pr-1.5 pl-2.5 text-xs font-semibold text-ink shadow-lg backdrop-blur-sm motion-safe:animate-toast-in motion-safe:transition-[opacity,translate] motion-safe:duration-150 ${
        leaving ? 'pointer-events-none -translate-y-1 opacity-0' : ''
      }`}
    >
      <span className={`grid size-4.5 shrink-0 place-items-center rounded-full text-3xs text-white ${accent}`} aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">{message}</span>
      <button
        type="button"
        className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-muted hover:bg-brand-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-blue-600"
        aria-label="Dismiss notification"
        onClick={() => dismissToast(id)}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

/** Floats toasts at the top-centre, above the map, without taking layout space. */
function ToastContainer() {
  const toasts = useToasts();

  return (
    <section
      className="pointer-events-none fixed inset-x-0 top-3 z-1000 flex flex-col items-center gap-2 px-4"
      aria-label="Notifications"
    >
      {toasts.map((toast) => <ToastItem key={toast.id} {...toast} />)}
    </section>
  );
}

export default ToastContainer;
