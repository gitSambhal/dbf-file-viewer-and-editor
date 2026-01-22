
import React from 'react';

interface CustomModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'info';
}

const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'info'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${variant === 'danger' ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400'}`}>
              <i className={`fa-solid ${variant === 'danger' ? 'fa-triangle-exclamation' : 'fa-circle-info'} text-lg`}></i>
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
            {message}
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-bold text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`px-6 py-2 text-sm font-black uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-95 ${
                variant === 'danger' 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomModal;
