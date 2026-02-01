import React, { useState, useEffect, useCallback, useContext, createContext, useRef } from 'react';
import { AlertTriangle, CheckCircle, Info, X, WifiOff, RefreshCw } from 'lucide-react';

const ToastContext = createContext(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, options = {}) => {
    const id = ++toastIdCounter;
    const toast = {
      id,
      message,
      type: options.type || 'error', // 'error', 'success', 'warning', 'info'
      duration: options.duration ?? (options.type === 'success' ? 3000 : 5000),
      action: options.action || null, // { label: 'Retry', onClick: () => {} }
      isNetwork: options.isNetwork || false,
    };
    setToasts(prev => [...prev, toast]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showError = useCallback((message, options = {}) => {
    return addToast(message, { ...options, type: 'error' });
  }, [addToast]);

  const showSuccess = useCallback((message, options = {}) => {
    return addToast(message, { ...options, type: 'success' });
  }, [addToast]);

  const showWarning = useCallback((message, options = {}) => {
    return addToast(message, { ...options, type: 'warning' });
  }, [addToast]);

  const showInfo = useCallback((message, options = {}) => {
    return addToast(message, { ...options, type: 'info' });
  }, [addToast]);

  const showNetworkError = useCallback((message, retryFn) => {
    return addToast(message || 'Unable to connect to the server. Please check your connection.', {
      type: 'error',
      isNetwork: true,
      duration: 8000,
      action: retryFn ? { label: 'Retry', onClick: retryFn } : null,
    });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, showError, showSuccess, showWarning, showInfo, showNetworkError }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }) {
  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      data-toast-container
      role="region"
      aria-label="Notifications"
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  }, [toast.id, onRemove]);

  useEffect(() => {
    if (toast.duration > 0) {
      timerRef.current = setTimeout(dismiss, toast.duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.duration, dismiss]);

  const typeConfig = {
    error: {
      bg: 'bg-red-50 dark:bg-red-900/40 border-red-200 dark:border-red-800',
      icon: toast.isNetwork ? <WifiOff className="w-5 h-5 text-red-500" /> : <AlertTriangle className="w-5 h-5 text-red-500" />,
      text: 'text-red-800 dark:text-red-200',
    },
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800',
      icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
      text: 'text-emerald-800 dark:text-emerald-200',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800',
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      text: 'text-amber-800 dark:text-amber-200',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800',
      icon: <Info className="w-5 h-5 text-blue-500" />,
      text: 'text-blue-800 dark:text-blue-200',
    },
  };

  const config = typeConfig[toast.type] || typeConfig.error;

  return (
    <div
      role="alert"
      data-toast
      data-toast-type={toast.type}
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg transition-all duration-300 ${config.bg} ${
        isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-slide-in'
      }`}
      style={{
        animation: isExiting ? 'none' : 'slideIn 0.3s ease-out',
      }}
    >
      <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${config.text}`}>{toast.message}</p>
        {toast.action && (
          <button
            onClick={() => {
              toast.action.onClick();
              dismiss();
            }}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            data-toast-retry
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={dismiss}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
      </button>
    </div>
  );
}

// CSS animation injected via style tag
const styleId = 'toast-animations';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(1rem); }
      to { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);
}

export default ToastProvider;
