import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Search } from "lucide-react";

export type ToastMessage = {
  id: string;
  title: string;
  description: string;
  type?: 'clue' | 'info' | 'error';
};

type ToastContextType = {
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);

    // Tự động tắt sau 4s
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-notification toast-${t.type || 'info'}`}>
            <div className="toast-icon">
              {t.type === 'clue' ? <Search size={24} color="#38bdf8" /> : '💡'}
            </div>
            <div>
              <div className="toast-title">{t.title}</div>
              <div className="toast-desc">{t.description}</div>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
