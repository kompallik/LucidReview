import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../lib/cn.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  toast: (message: string, type?: ToastType, duration?: number) => void;
  dismiss: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

// ─── Toast styling ────────────────────────────────────────────────────────────

const TOAST_STYLES: Record<ToastType, { container: string; icon: typeof Info }> = {
  success: {
    container: 'bg-green-50 border-green-200 text-green-800',
    icon: CheckCircle,
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-800',
    icon: AlertCircle,
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-800',
    icon: AlertTriangle,
  },
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: Info,
  },
};

// ─── Single Toast ─────────────────────────────────────────────────────────────

function ToastItem({
  toast: t,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  const style = TOAST_STYLES[t.type];
  const Icon = style.icon;

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-4 py-3 shadow-lg animate-slide-in-right',
        style.container,
      )}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{t.message}</p>
      <button
        onClick={() => onDismiss(t.id)}
        className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Toast Container ──────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 4000) => {
      const id = `toast-${++toastCounter}`;
      const newToast: ToastMessage = { id, message, type, duration };
      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        const timer = setTimeout(() => {
          dismiss(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss],
  );

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast: addToast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
