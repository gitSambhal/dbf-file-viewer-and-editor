
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${variant === 'danger' ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-500'}`}>
              <i className={`fa-solid ${variant === 'danger' ? 'fa-triangle-exclamation' : 'fa-circle-info'} text-lg`}></i>
            </div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            {message}
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`px-6 py-2 text-sm font-black uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-95 ${
                variant === 'danger' 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
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
