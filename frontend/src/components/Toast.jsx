import React, { useEffect } from 'react';

const Toast = ({ toasts, removeToast }) => {
  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => removeToast(toast.id), 4000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, removeToast]);

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.type}`}
          onClick={(e) => {
            e.currentTarget.classList.add('toast-exit');
            setTimeout(() => removeToast(toast.id), 300);
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
};

export default Toast;
