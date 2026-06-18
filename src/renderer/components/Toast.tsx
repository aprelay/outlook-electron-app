import React, { useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

let toastIdCounter = 0;

export function useToast(): {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: number) => void;
} {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string) => {
      const id = ++toastIdCounter;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => removeToast(id), 4000);
    },
    [removeToast]
  );

  return { toasts, addToast, removeToast };
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: number) => void;
}

export function ToastContainer({
  toasts,
  onRemove,
}: ToastContainerProps): React.ReactElement | null {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.type}`}
          onClick={() => onRemove(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
