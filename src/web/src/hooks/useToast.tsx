import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastType = 'success' | 'info' | 'demo' | 'error';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ToastApi {
  success: (message: string) => void;
  info: (message: string) => void;
  demo: (message: string) => void;
  error: (message: string) => void;
}

const DISMISS_MS = 3000;

const ToastContext = createContext<ToastApi | null>(null);

function createToastId() {
  return `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer != null) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type: ToastType, message: string) => {
      const id = createToastId();
      setToasts((prev) => [...prev, { id, type, message }]);
      const timer = window.setTimeout(() => dismiss(id), DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  const toast = useMemo<ToastApi>(
    () => ({
      success: (message) => show('success', message),
      info: (message) => show('info', message),
      demo: (message) => show('demo', message),
      error: (message) => show('error', message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" aria-live="polite" aria-relevant="additions">
        {toasts.map((item) => (
          <div key={item.id} className={`toast toast--${item.type}`} role="status">
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
