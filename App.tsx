
import React, { useState, useCallback, useRef, useMemo } from 'react';
import { DBFData, AppStatus, DBFRow, RangeFilter } from './types';
import { DBFParser } from './services/dbfParser';
import VirtualTable from './components/VirtualTable';
import Sidebar from './components/Sidebar';
import CustomModal from './components/CustomModal';

const App: React.FC = () => {
  const [tabs, setTabs] = useState<DBFData[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState<number>(-1);
  const [selectedRowIndices, setSelectedRowIndices] = useState<Record<string, number | null>>({});
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null });
  
  const [frFind, setFrFind] = useState('');
  const [frReplace, setFrReplace] = useState('');

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'info'
  });

  const [rangeFilter, setRangeFilter] = useState<RangeFilter>({ 
    mode: 'all', 
    count: 100, 
    from: 1, 
    to: 100 
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs[activeTabIndex] || null;
  const currentSelectedRowIndex = activeTab ? selectedRowIndices[activeTab.id] ?? null : null;

  const visibleData = useMemo(() => {
    if (!activeTab) return null;
    let rows = activeTab.rows;
    
    if (rangeFilter.mode === 'first') {
      rows = activeTab.rows.slice(0, rangeFilter.count);
    } else if (rangeFilter.mode === 'last') {
      rows = activeTab.rows.slice(-rangeFilter.count);
    } else if (rangeFilter.mode === 'range') {
      rows = activeTab.rows.slice(Math.max(0, rangeFilter.from - 1), rangeFilter.to);
    }

    return { ...activeTab, rows };
  }, [activeTab, rangeFilter]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setStatus(AppStatus.LOADING);
    try {
      const newTabs: DBFData[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const buffer = await file.arrayBuffer();
        const dbfData = await DBFParser.parse(buffer, file.name);
        newTabs.push(dbfData);
      }
      
      const newIndex = tabs.length;
      setTabs(prev => [...prev, ...newTabs]);
      setActiveTabIndex(newIndex);
      setStatus(AppStatus.READY);
    } catch (err) {
      console.error(err);
      setError('Failed to parse DBF file.');
      setStatus(AppStatus.ERROR);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEdit = useCallback((rowIndex: number, fieldName: string, value: any) => {
    setTabs(prev => {
      const newTabs = [...prev];
      if (activeTabIndex < 0 || activeTabIndex >= newTabs.length) return prev;
      const tab = { ...newTabs[activeTabIndex] };
      const newRows = [...tab.rows];
      newRows[rowIndex] = { ...newRows[rowIndex], [fieldName]: value };
      tab.rows = newRows;
      newTabs[activeTabIndex] = tab;
      return newTabs;
    });
  }, [activeTabIndex]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const executeFindReplace = () => {
    if (!activeTab || !frFind || activeTabIndex === -1) return;

    setTabs(prev => {
      const newTabs = [...prev];
      const tab = { ...newTabs[activeTabIndex] };
      tab.rows = tab.rows.map(row => {
        const newRow = { ...row };
        let modified = false;
        Object.keys(newRow).forEach(k => {
          if (newRow[k] !== null && newRow[k] !== undefined) {
            const strVal = newRow[k].toString();
            if (strVal.includes(frFind)) {
              const newVal = strVal.split(frFind).join(frReplace);
              if (typeof row[k] === 'number') {
                const numVal = parseFloat(newVal);
                newRow[k] = isNaN(numVal) ? newVal : numVal;
              } else {
                newRow[k] = newVal;
              }
              modified = true;
            }
          }
        });
        return modified ? newRow : row;
      });
      newTabs[activeTabIndex] = tab;
      return newTabs;
    });
    setShowFindReplace(false);
    setFrFind('');
    setFrReplace('');
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const handleFindReplaceTrigger = () => {
    if (!frFind) return;
    setModalConfig({
      isOpen: true,
      title: 'Bulk Update',
      message: `Are you sure you want to replace all occurrences of "${frFind}" with "${frReplace}"? This will modify every record in the current table.`,
      onConfirm: executeFindReplace,
      variant: 'info'
    });
  };

  const handleExport = (format: 'dbf' | 'csv' | 'json') => {
    if (!activeTab) return;
    let blob: Blob;
    let extension: string;

    if (format === 'dbf') {
      blob = DBFParser.generateBlob(activeTab);
      extension = 'dbf';
    } else if (format === 'csv') {
      const headers = activeTab.header.fields.map(f => f.name).join(',');
      const rows = activeTab.rows.map(row => 
        activeTab.header.fields.map(f => {
          const val = row[f.name];
          if (val === null || val === undefined) return '""';
          return `"${val.toString().replace(/"/g, '""')}"`;
        }).join(',')
      ).join('\n');
      blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
      extension = 'csv';
    } else {
      blob = new Blob([JSON.stringify(activeTab.rows, null, 2)], { type: 'application/json' });
      extension = 'json';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exported_${activeTab.fileName.split('.')[0]}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const executeDeleteRow = (originalIndex: number) => {
    if (!activeTab || activeTabIndex === -1) return;
    const targetTabId = activeTab.id;

    setTabs(prev => {
      const newTabs = [...prev];
      const targetIndex = newTabs.findIndex(t => t.id === targetTabId);
      if (targetIndex === -1) return prev;
      
      const tab = { ...newTabs[targetIndex] };
      const updatedRows = [...tab.rows];
      updatedRows.splice(originalIndex, 1);
      
      tab.rows = updatedRows;
      newTabs[targetIndex] = tab;
      return newTabs;
    });

    setSelectedRowIndices(prev => ({ ...prev, [targetTabId]: null }));
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const handleDeleteRow = useCallback((originalIndex: number) => {
    setModalConfig({
      isOpen: true,
      title: 'Delete Record',
      message: `Are you sure you want to permanently delete record #${originalIndex + 1}? This action cannot be reversed.`,
      onConfirm: () => executeDeleteRow(originalIndex),
      variant: 'danger'
    });
  }, [activeTab, activeTabIndex]);

  const handleSelectRow = useCallback((rowIndex: number) => {
    if (!activeTab) return;
    setSelectedRowIndices(prev => ({ ...prev, [activeTab.id]: rowIndex }));
  }, [activeTab]);

  const handleAddRow = () => {
    if (!activeTab) return;
    setTabs(prev => {
      const newTabs = [...prev];
      const tab = { ...newTabs[activeTabIndex] };
      const emptyRow: DBFRow = {};
      tab.header.fields.forEach(f => {
        const type = f.type.toUpperCase();
        emptyRow[f.name] = ['N', 'F', 'I', 'B', 'Y'].includes(type) ? 0 : '';
      });
      tab.rows = [emptyRow, ...tab.rows];
      newTabs[activeTabIndex] = tab;
      return newTabs;
    });
  };

  const toggleColumnVisibility = (fieldName: string) => {
    setTabs(prev => {
      const newTabs = [...prev];
      const tab = { ...newTabs[activeTabIndex] };
      tab.hiddenColumns = tab.hiddenColumns.includes(fieldName) 
        ? tab.hiddenColumns.filter(c => c !== fieldName) 
        : [...tab.hiddenColumns, fieldName];
      newTabs[activeTabIndex] = tab;
      return newTabs;
    });
  };

  const closeTab = (index: number) => {
    setTabs(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setStatus(AppStatus.IDLE);
        setActiveTabIndex(-1);
      } else if (activeTabIndex >= next.length) {
        setActiveTabIndex(next.length - 1);
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      <CustomModal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        variant={modalConfig.variant}
        confirmLabel={modalConfig.variant === 'danger' ? 'Delete' : 'Confirm'}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm z-30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-indigo-200 shadow-lg">
              <i className="fa-solid fa-database text-white text-lg"></i>
            </div>
            <div>
              <h1 className="font-bold text-slate-800 leading-tight">DBF Nexus</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">V2.5 Professional</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeTab && (
              <>
                <div className="relative group">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                  <input
                    type="text"
                    placeholder="Search Table..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm w-48 focus:w-64 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <button
                  onClick={() => setShowFindReplace(!showFindReplace)}
                  className={`p-2 w-10 h-10 border rounded-lg transition-all flex items-center justify-center ${showFindReplace ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}
                  title="Find & Replace"
                >
                  <i className="fa-solid fa-repeat"></i>
                </button>
                <button
                  onClick={() => setShowColumnManager(!showColumnManager)}
                  className="p-2 w-10 h-10 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center"
                  title="Manage Columns"
                >
                  <i className="fa-solid fa-columns"></i>
                </button>
                <div className="h-8 w-[1px] bg-slate-200 mx-1"></div>
                <button
                  onClick={handleAddRow}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  + Row
                </button>
                <div className="relative group">
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-md flex items-center gap-2">
                    <i className="fa-solid fa-download"></i> Export <i className="fa-solid fa-chevron-down text-[10px]"></i>
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <button onClick={() => handleExport('dbf')} className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 font-medium text-slate-700 first:rounded-t-xl">Original (.dbf)</button>
                    <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 font-medium text-slate-700">Spreadsheet (.csv)</button>
                    <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 font-medium text-slate-700 last:rounded-b-xl">Data (.json)</button>
                  </div>
                </div>
              </>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept=".dbf" multiple onChange={handleFileUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`p-2 w-10 h-10 rounded-lg transition-all flex items-center justify-center ${tabs.length === 0 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-600'}`}
              title="Upload DBF Files"
            >
              <i className="fa-solid fa-folder-plus"></i>
            </button>
          </div>
        </header>

        {tabs.length > 0 && (
          <div className="flex bg-slate-100 border-b border-slate-200 px-8 pt-2 gap-1 z-20 shrink-0">
            {tabs.map((tab, idx) => (
              <div key={tab.id} onClick={() => setActiveTabIndex(idx)}
                className={`group flex items-center gap-2 px-4 py-2 rounded-t-lg text-xs font-semibold cursor-pointer transition-all border-x border-t
                  ${activeTabIndex === idx ? 'bg-white border-slate-200 text-indigo-600 shadow-sm translate-y-[1px]' : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-200'}`}>
                <span className="max-w-[150px] truncate">{tab.fileName}</span>
                <button onClick={(e) => { e.stopPropagation(); closeTab(idx); }} className="ml-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab && (
          <div className="bg-white border-b border-slate-200 px-8 py-2 flex items-center gap-6 z-20 overflow-x-auto whitespace-nowrap">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-filter text-slate-400 text-[10px]"></i>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Slicer</span>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
              {['all', 'first', 'last', 'range'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setRangeFilter(prev => ({ ...prev, mode: mode as any }))}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${rangeFilter.mode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
            {rangeFilter.mode !== 'all' && (
              <div className="flex items-center gap-2 animate-in fade-in zoom-in-95">
                <input 
                  type="number" 
                  value={rangeFilter.count}
                  onChange={(e) => setRangeFilter(prev => ({ ...prev, count: Math.max(1, parseInt(e.target.value) || 0) }))}
                  className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
            )}
            <div className="ml-auto text-[10px] text-slate-400 font-medium">
              Loaded: <span className="text-slate-800 font-bold">{activeTab.rows.length} records</span>
            </div>
          </div>
        )}

        <div className="flex-1 p-8 overflow-hidden relative flex flex-col">
          {showFindReplace && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800">Find & Replace All</h3>
                <button onClick={() => setShowFindReplace(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Find Text</label>
                  <input placeholder="Text to search for..." value={frFind} onChange={e => setFrFind(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Replace With</label>
                  <input placeholder="Replacement text..." value={frReplace} onChange={e => setFrReplace(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <button 
                  onClick={handleFindReplaceTrigger} 
                  disabled={!frFind}
                  className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 ${!frFind ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                  Apply Replacement
                </button>
              </div>
            </div>
          )}

          {showColumnManager && activeTab && (
            <div className="absolute top-4 right-12 z-40 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">Layout Engine</h3>
                <button onClick={() => setShowColumnManager(false)}><i className="fa-solid fa-xmark text-slate-400"></i></button>
              </div>
              <div className="max-h-80 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {activeTab.header.fields.map(field => (
                  <label key={field.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group">
                    <input type="checkbox" checked={!activeTab.hiddenColumns.includes(field.name)} onChange={() => toggleColumnVisibility(field.name)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 transition-all" />
                    <span className="text-sm text-slate-700 truncate font-medium group-hover:text-indigo-600">{field.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {status === AppStatus.IDLE && tabs.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl shadow-indigo-100/50">
                <i className="fa-solid fa-database text-4xl text-indigo-500"></i>
              </div>
              <h2 className="text-3xl font-extrabold text-slate-800 mb-3">Professional DBF Studio</h2>
              <p className="text-slate-500 max-w-lg mx-auto mb-10 leading-relaxed">The browser-based power tool for dBase tables. Virtualized scroll, multi-format exports, and AI-driven data intelligence.</p>
              <button onClick={() => fileInputRef.current?.click()} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all">START EDITING</button>
            </div>
          )}

          {visibleData && (
            <div className="h-full flex flex-col animate-in slide-in-from-bottom-4 duration-700">
               <div className="flex-1 min-h-0">
                  <VirtualTable 
                    data={visibleData} 
                    searchTerm={searchTerm} 
                    selectedRowIndex={currentSelectedRowIndex}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    onEdit={handleEdit} 
                    onDeleteRow={handleDeleteRow}
                    onSelectRow={handleSelectRow}
                  />
               </div>
            </div>
          )}
        </div>
      </main>
      <Sidebar data={activeTab} selectedRowIndex={currentSelectedRowIndex} />
    </div>
  );
};

export default App;
