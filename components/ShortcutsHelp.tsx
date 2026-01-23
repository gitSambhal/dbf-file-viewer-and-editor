
import React from 'react';

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutItem: React.FC<{ keys: string[]; description: string }> = ({ keys, description }) => (
  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
    <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{description}</span>
    <div className="flex items-center gap-1.5">
      {keys.map(key => (
        <kbd key={key} className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 border-b-2 border-slate-300 dark:border-slate-600 rounded-md">
          {key}
        </kbd>
      ))}
    </div>
  </div>
);

const ShortcutsHelp: React.FC<ShortcutsHelpProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-4">
            <i className="fa-regular fa-keyboard text-2xl text-indigo-500"></i>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Keyboard Shortcuts</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Boost your productivity with these shortcuts.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg bg-slate-100 dark:bg-slate-800">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div className="p-6 space-y-2">
          <ShortcutItem keys={['Ctrl', '/']} description="Show this help menu" />
          <ShortcutItem keys={['Ctrl', 'O']} description="Open a new DBF file" />
          <ShortcutItem keys={['Ctrl', 'F']} description="Open Find & Replace" />
          <ShortcutItem keys={['Esc']} description="Close modals or exit Zen Mode" />
          <ShortcutItem keys={['Ctrl', '+']} description="Add a new row to the top" />
        </div>
      </div>
    </div>
  );
};

export default ShortcutsHelp;
