
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { DBFData, AppStatus, DBFRow, RangeFilter, QueryCondition, ChangesMap } from './types';
import { DBFParser } from './services/dbfParser';
import VirtualTable from './components/VirtualTable';
import Sidebar from './components/Sidebar';
import CustomModal from './components/CustomModal';
import ShortcutsHelp from './components/ShortcutsHelp';

const App: React.FC = () => {
  const [tabs, setTabs] = useState<DBFData[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState<number>(-1);
  const [selectedRowIndices, setSelectedRowIndices] = useState<Record<string, number | null>>({});

  const activeTab = tabs[activeTabIndex] || null;
  const currentSelectedRowIndex = activeTab ? selectedRowIndices[activeTab.id] ?? null : null;
  
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showQueryBuilder, setShowQueryBuilder] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null });
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  
  // Layout Management
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Query Engine State
  const [queryConditions, setQueryConditions] = useState<QueryCondition[]>([]);
  const [newCondition, setNewCondition] = useState<Partial<QueryCondition>>({ field: '', operator: 'contains', value: '' });

  const [frFind, setFrFind] = useState('');
  const [frReplace, setFrReplace] = useState('');
  const [showNullColumnWarning, setShowNullColumnWarning] = useState(true);
  const [hideNonMatchingTabs, setHideNonMatchingTabs] = useState(false);

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

  // Tab Context Menu State
  const [tabContextMenu, setTabContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    tabIndex: number;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    tabIndex: -1
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).contentEditable === 'true' ||
        activeElement.closest('[contenteditable="true"]')
      );

      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
      if (e.key === '?' && !isInputFocused) {
        e.preventDefault();
        setShowInfo(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        handleOpenFilesClick();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !isInputFocused) {
        e.preventDefault();
        if (activeTab) setShowFindReplace(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '+') {
        e.preventDefault();
        if (activeTab) handleAddRow();
      }
      if (e.key === 'Escape') {
        // If search input is focused and has content, clear it first
        if (isInputFocused && searchTerm) {
          e.preventDefault();
          setSearchTerm('');
          return;
        }

        if (showShortcuts) setShowShortcuts(false);
        if (showColumnManager) setShowColumnManager(false);
        if (showFindReplace) setShowFindReplace(false);
        if (showQueryBuilder) setShowQueryBuilder(false);
        if (showInfo) setShowInfo(false);
        if (modalConfig.isOpen) setModalConfig(prev => ({...prev, isOpen: false}));
        if (tabContextMenu.isOpen) setTabContextMenu(prev => ({ ...prev, isOpen: false }));
        if (!headerVisible || !sidebarVisible) {
          setHeaderVisible(true);
          if (tabs.length > 0) setSidebarVisible(true);
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (tabContextMenu.isOpen) {
        setTabContextMenu(prev => ({ ...prev, isOpen: false }));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [activeTab, showShortcuts, showColumnManager, showFindReplace, showQueryBuilder, showInfo, modalConfig.isOpen, headerVisible, sidebarVisible, tabs.length, tabContextMenu.isOpen]);
  
  const handleOpenFilesClick = async () => {
    try {
      const anyWindow = window as any;
      if (anyWindow.showOpenFilePicker) {
        const handles = await anyWindow.showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: 'dBase DBF',
              accept: { 'application/octet-stream': ['.dbf'] }
            }
          ]
        });
        const items: Array<{ file: File; handle?: any }> = await Promise.all(
          handles.map(async (h: any) => ({ file: await h.getFile(), handle: h }))
        );
        if (items.length > 0) {
          await processFileSources(items);
        }
      } else {
        fileInputRef.current?.click();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const processFiles = async (files: File[]) => {
    setStatus(AppStatus.LOADING);
    try {
      const newTabs: DBFData[] = [];
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.dbf')) continue;
        
        const buffer = await file.arrayBuffer();
        const dbfData = await DBFParser.parse(buffer, file.name);
        newTabs.push(dbfData);
      }
      
      if (newTabs.length > 0) {
        const newIndex = tabs.length;
        setTabs(prev => [...prev, ...newTabs]);
        setActiveTabIndex(newIndex);
        setStatus(AppStatus.READY);
      } else {
        setStatus(tabs.length > 0 ? AppStatus.READY : AppStatus.IDLE);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to parse DBF file.');
      setStatus(AppStatus.ERROR);
    }
  };
  
  const processFileSources = async (items: Array<{ file: File; handle?: any }>) => {
    setStatus(AppStatus.LOADING);
    try {
      const newTabs: DBFData[] = [];
      for (const { file, handle } of items) {
        try {
          if (!file.name.toLowerCase().endsWith('.dbf')) continue;
          const buffer = await file.arrayBuffer();
          const parsed = await DBFParser.parse(buffer, file.name);
          newTabs.push({ ...parsed, fileHandle: handle, lastModified: file.lastModified, changes: {} });
        } catch (fileErr) {
          console.warn(`Failed to process file ${file.name}:`, fileErr);
          // Continue with other files
        }
      }
      if (newTabs.length > 0) {
        const newIndex = tabs.length;
        setTabs(prev => [...prev, ...newTabs]);
        setActiveTabIndex(newIndex);
        setStatus(AppStatus.READY);
        setSidebarVisible(true);
        console.log(`Successfully loaded ${newTabs.length} DBF file(s)`);
      } else {
        setStatus(tabs.length > 0 ? AppStatus.READY : AppStatus.IDLE);
        setError('No valid DBF files could be processed.');
      }
    } catch (err) {
      console.error('Error in batch processing:', err);
      setError('Failed to process DBF files.');
      setStatus(AppStatus.ERROR);
    }
  };
  
  const computeChanges = (prev: DBFData, next: DBFData): ChangesMap => {
    const changes: ChangesMap = {};
    const maxLen = Math.max(prev.rows.length, next.rows.length);
    for (let i = 0; i < maxLen; i++) {
      const prevRow = prev.rows[i];
      const nextRow = next.rows[i];
      if (!nextRow || !prevRow) continue;
      const rowChanges: Record<string, any> = {};
      prev.header.fields.forEach(f => {
        const k = f.name;
        const a = prevRow[k];
        const b = nextRow[k];
        const aStr = a?.toString?.() ?? '';
        const bStr = b?.toString?.() ?? '';
        if (aStr !== bStr) {
          rowChanges[k] = { oldValue: a, newValue: b, updatedAt: Date.now() };
        }
      });
      if (Object.keys(rowChanges).length > 0) {
        changes[i] = rowChanges as any;
      }
    }
    return changes;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dt = e.dataTransfer;
    const items: Array<{ file: File; handle?: any }> = [];

    // First try to get files from dt.files (most reliable)
    if (dt.files && dt.files.length > 0) {
      Array.from(dt.files).forEach(f => {
        const file = f as File;
        if (file.name.toLowerCase().endsWith('.dbf')) {
          items.push({ file });
        }
      });
    }

    // Fallback to dt.items if dt.files didn't work
    if (items.length === 0 && dt.items && dt.items.length > 0) {
      try {
        for (let i = 0; i < dt.items.length; i++) {
          const it: any = dt.items[i];
          if (it.kind === 'file') {
            if (typeof it.getAsFileSystemHandle === 'function') {
              const handle = await it.getAsFileSystemHandle();
              if (handle && handle.kind === 'file') {
                const file = await handle.getFile();
                if (file.name.toLowerCase().endsWith('.dbf')) {
                  items.push({ file, handle });
                }
                continue;
              }
            }
            const fileObj = typeof it.getAsFile === 'function' ? (it.getAsFile() as File | null) : null;
            if (fileObj && fileObj.name.toLowerCase().endsWith('.dbf')) {
              items.push({ file: fileObj as File });
            }
          }
        }
      } catch (err) {
        console.warn('Drag-and-drop handle acquisition failed.', err);
      }
    }

    if (items.length > 0) {
      console.log(`Processing ${items.length} DBF files from drag and drop`);
      await processFileSources(items);
    } else {
      console.log('No DBF files found in drop');
    }
  };
  
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const updates: Array<{ index: number; data: DBFData }> = [];
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        if (!tab.fileHandle) continue;
        try {
          const file: File = await (tab.fileHandle as any).getFile();
          if (!tab.lastModified || file.lastModified > tab.lastModified) {
            const buffer = await file.arrayBuffer();
            const parsed = await DBFParser.parse(buffer, file.name);
            const changes = computeChanges(tab, parsed);
            updates.push({
              index: i,
              data: { ...parsed, id: tab.id, hiddenColumns: tab.hiddenColumns, fileHandle: tab.fileHandle, lastModified: file.lastModified, changes }
            });
          }
        } catch (err) {
          // Ignore polling errors
        }
      }
      if (!cancelled && updates.length > 0) {
        setTabs(prev => {
          const next = [...prev];
          updates.forEach(u => { next[u.index] = u.data; });
          return next;
        });
      }
    };
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tabs]);

  const addQueryCondition = () => {
    if (!newCondition.field || !newCondition.value) return;
    const cond: QueryCondition = {
      id: Math.random().toString(36).substr(2, 9),
      field: newCondition.field,
      operator: newCondition.operator as any,
      value: newCondition.value
    };
    setQueryConditions(prev => [...prev, cond]);
    setNewCondition({ field: '', operator: 'contains', value: '' });
    setShowQueryBuilder(false);
  };

  const removeQueryCondition = (id: string) => {
    setQueryConditions(prev => prev.filter(c => c.id !== id));
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
    setSidebarVisible(true);
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

  const handleInsertRow = useCallback((index: number, position: 'above' | 'below') => {
    if (!activeTab) return;
    setTabs(prev => {
      const newTabs = [...prev];
      const tab = { ...newTabs[activeTabIndex] };
      const emptyRow: DBFRow = {};
      tab.header.fields.forEach(f => {
        const type = f.type.toUpperCase();
        emptyRow[f.name] = ['N', 'F', 'I', 'B', 'Y'].includes(type) ? 0 : '';
      });
      
      const targetIndex = position === 'above' ? index : index + 1;
      const updatedRows = [...tab.rows];
      updatedRows.splice(targetIndex, 0, emptyRow);
      
      tab.rows = updatedRows;
      newTabs[activeTabIndex] = tab;
      return newTabs;
    });
  }, [activeTab, activeTabIndex]);

  const handleDuplicateRow = useCallback((index: number) => {
    if (!activeTab) return;
    setTabs(prev => {
      const newTabs = [...prev];
      const tab = { ...newTabs[activeTabIndex] };
      const rowToDuplicate = { ...tab.rows[index] };
      
      const updatedRows = [...tab.rows];
      updatedRows.splice(index + 1, 0, rowToDuplicate);
      
      tab.rows = updatedRows;
      newTabs[activeTabIndex] = tab;
      return newTabs;
    });
  }, [activeTab, activeTabIndex]);

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
        setSidebarVisible(false);
      } else if (activeTabIndex >= next.length) {
        setActiveTabIndex(next.length - 1);
      }
      return next;
    });
  };

  const closeAllTabs = () => {
    setTabs([]);
    setStatus(AppStatus.IDLE);
    setActiveTabIndex(-1);
    setSidebarVisible(false);
    setTabContextMenu(prev => ({ ...prev, isOpen: false }));
  };

  const closeOtherTabs = (keepIndex: number) => {
    setTabs(prev => [prev[keepIndex]]);
    setActiveTabIndex(0);
    setTabContextMenu(prev => ({ ...prev, isOpen: false }));
  };

  const closeTabsToRight = (fromIndex: number) => {
    setTabs(prev => {
      const next = prev.slice(0, fromIndex + 1);
      if (activeTabIndex > fromIndex) {
        setActiveTabIndex(fromIndex);
      }
      return next;
    });
    setTabContextMenu(prev => ({ ...prev, isOpen: false }));
  };

  const closeTabsToLeft = (fromIndex: number) => {
    setTabs(prev => {
      const next = prev.slice(fromIndex);
      setActiveTabIndex(0);
      return next;
    });
    setTabContextMenu(prev => ({ ...prev, isOpen: false }));
  };

  const handleTabContextMenu = (e: React.MouseEvent, tabIndex: number) => {
    e.preventDefault();
    setTabContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      tabIndex
    });
  };

  const closeTabContextMenu = () => {
    setTabContextMenu(prev => ({ ...prev, isOpen: false }));
  };

  // Global search results - only active when multiple files are loaded
  const globalSearchResults = useMemo(() => {
    if (tabs.length <= 1 || !searchTerm.trim()) return new Set<number>();

    const matchingTabIndices = new Set<number>();
    const searchValue = searchTerm.toLowerCase().trim();

    tabs.forEach((tab, index) => {
      const hasMatch = tab.rows.some(row =>
        Object.values(row).some(value =>
          value?.toString().toLowerCase().includes(searchValue)
        )
      );
      if (hasMatch) {
        matchingTabIndices.add(index);
      }
    });

    return matchingTabIndices;
  }, [tabs, searchTerm]);

  // Auto-switch to first visible tab when filtering hides the current active tab
  useEffect(() => {
    if (hideNonMatchingTabs && searchTerm.trim() && tabs.length > 0) {
      const isActiveTabVisible = globalSearchResults.has(activeTabIndex);
      if (!isActiveTabVisible) {
        // Find the first visible tab
        for (let i = 0; i < tabs.length; i++) {
          if (globalSearchResults.has(i)) {
            setActiveTabIndex(i);
            break;
          }
        }
      }
    }
  }, [hideNonMatchingTabs, searchTerm, globalSearchResults, activeTabIndex, tabs.length]);


  const visibleData = useMemo(() => {
    if (!activeTab) return null;

    // 1. Apply Query Filtering
    let processedRows = activeTab.rows;
    if (queryConditions.length > 0) {
      processedRows = processedRows.filter(row => {
        return queryConditions.every(cond => {
          const rowValue = (row[cond.field] ?? '').toString().toLowerCase();
          const targetValue = cond.value.toLowerCase();

          switch (cond.operator) {
            case 'equals': return rowValue === targetValue;
            case 'contains': return rowValue.includes(targetValue);
            case 'starts': return rowValue.startsWith(targetValue);
            case 'gt': return parseFloat(rowValue) > parseFloat(targetValue);
            case 'lt': return parseFloat(rowValue) < parseFloat(targetValue);
            default: return true;
          }
        });
      });
    }

    // 2. Apply Search Filtering (if search term exists)
    if (searchTerm.trim()) {
      const searchValue = searchTerm.toLowerCase().trim();
      processedRows = processedRows.filter(row =>
        Object.values(row).some(value =>
          value?.toString().toLowerCase().includes(searchValue)
        )
      );
    }

    // 3. Apply Slicer
    let rows = processedRows;
    if (rangeFilter.mode === 'first') {
      rows = rows.slice(0, rangeFilter.count);
    } else if (rangeFilter.mode === 'last') {
      rows = rows.slice(-rangeFilter.count);
    } else if (rangeFilter.mode === 'range') {
      rows = rows.slice(Math.max(0, rangeFilter.from - 1), rangeFilter.to);
    }

    return { ...activeTab, rows };
  }, [activeTab, rangeFilter, queryConditions, searchTerm]);

  return (
    <div 
      className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-300 relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <ShortcutsHelp isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto animate-in zoom-in-95 duration-300">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">About DBF Nexus</h2>
                <button
                  onClick={() => setShowInfo(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>

              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fa-solid fa-database text-2xl text-indigo-600 dark:text-indigo-400"></i>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">DBF Nexus Professional</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Advanced browser-based DBF file viewer and editor</p>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Keyboard Shortcuts</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400">Open File</span>
                      <div className="flex gap-0.5">
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">Ctrl</kbd>
                        <span className="text-slate-400 dark:text-slate-500">+</span>
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">O</kbd>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400">Find & Replace</span>
                      <div className="flex gap-0.5">
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">Ctrl</kbd>
                        <span className="text-slate-400 dark:text-slate-500">+</span>
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">F</kbd>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400">Add Row</span>
                      <div className="flex gap-0.5">
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">Ctrl</kbd>
                        <span className="text-slate-400 dark:text-slate-500">+</span>
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">+</kbd>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400">Show Shortcuts</span>
                      <div className="flex gap-0.5">
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">Ctrl</kbd>
                        <span className="text-slate-400 dark:text-slate-500">+</span>
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">/</kbd>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400">Global Search</span>
                      <div className="flex gap-0.5">
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">Ctrl</kbd>
                        <span className="text-slate-400 dark:text-slate-500">+</span>
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">Shift</kbd>
                        <span className="text-slate-400 dark:text-slate-500">+</span>
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">F</kbd>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400">Show Info</span>
                      <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">?</kbd>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Developer</h4>
                  <div className="text-center">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Built by</p>
                    <a
                      href="https://www.linkedin.com/in/im-suhail-akhtar/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors"
                    >
                      <i className="fa-brands fa-linkedin"></i>
                      Suhail Akhtar
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>
    )}

    {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[200] bg-indigo-600/20 backdrop-blur-md border-4 border-dashed border-indigo-500 flex items-center justify-center pointer-events-none animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-12 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 scale-110">
            <i className="fa-solid fa-cloud-arrow-up text-7xl text-indigo-500 animate-bounce"></i>
            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Drop to Load DBF</h2>
            <p className="text-slate-500 dark:text-slate-400 font-bold">Instantly parse and view your data</p>
          </div>
        </div>
      )}

      <CustomModal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        variant={modalConfig.variant}
        confirmLabel={modalConfig.variant === 'danger' ? 'Delete' : 'Confirm'}
      />

      {/* Floating Zen Mode Controls - Only show when files are loaded */}
      {tabs.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[100] flex gap-2">
          {!sidebarVisible && (
            <button
              onClick={() => setSidebarVisible(true)}
              className="w-12 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl flex items-center justify-center text-slate-500 hover:text-indigo-500 transition-all active:scale-90"
              title="Show Sidebar"
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>
          )}
          {!headerVisible && (
            <button
              onClick={() => setHeaderVisible(true)}
              className="w-12 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl flex items-center justify-center text-slate-500 hover:text-indigo-500 transition-all active:scale-90"
              title="Show Header"
            >
              <i className="fa-solid fa-arrow-down"></i>
            </button>
          )}
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {headerVisible && (
          <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between shadow-sm z-30 shrink-0 transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-indigo-200 dark:shadow-indigo-900/20 shadow-lg">
                <i className="fa-solid fa-database text-white text-lg"></i>
              </div>
              <div>
                <h1 className="font-bold text-slate-800 dark:text-slate-100 leading-tight">DBF Nexus Professional</h1>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold text-nowrap">Online DBF Viewer & Editor</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {activeTab && (
                <>
                  <div className="flex flex-col items-start">
                    <div className="relative group">
                      <i className={`fa-solid fa-${tabs.length > 1 ? 'search' : 'magnifying-glass'} absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm`}></i>
                      <input
                        type="text"
                        placeholder={tabs.length > 1 ? "Search All Files..." : "Quick Search..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`pl-9 pr-8 py-2 ${tabs.length > 1 ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800' : 'bg-slate-100 dark:bg-slate-800 border-none'} rounded-lg text-sm w-48 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-200`}
                        title={tabs.length > 1 ? "Search across all loaded DBF files" : "Quick Search"}
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          title="Clear search"
                        >
                          <i className="fa-solid fa-xmark text-xs"></i>
                        </button>
                      )}
                    </div>
                    <div className={`mt-1 flex items-center gap-2 text-[10px] text-emerald-700 dark:text-emerald-300 transition-opacity duration-200 ${searchTerm && tabs.length > 1 && globalSearchResults.size > 0 ? 'opacity-100' : 'opacity-0'}`}>
                      <i className="fa-solid fa-search text-emerald-500 text-[8px]"></i>
                      <span>Found in {globalSearchResults.size || 0} file{(globalSearchResults.size || 0) > 1 ? 's' : ''}</span>
                      <label className="flex items-center gap-1.5 cursor-pointer ml-2">
                        <input
                          type="checkbox"
                          checked={hideNonMatchingTabs}
                          onChange={(e) => setHideNonMatchingTabs(e.target.checked)}
                          className="w-3 h-3 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-600"
                          disabled={!searchTerm || tabs.length <= 1 || globalSearchResults.size === 0}
                        />
                        <span className="text-[9px] text-slate-600 dark:text-slate-400">Show results only</span>
                      </label>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowQueryBuilder(!showQueryBuilder)}
                    className={`p-2 w-10 h-10 border rounded-lg transition-all flex items-center justify-center ${showQueryBuilder ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
                    title="Filter Logic Engine"
                  >
                    <i className="fa-solid fa-filter"></i>
                  </button>
                  <button
                    onClick={() => setShowFindReplace(!showFindReplace)}
                    className={`p-2 w-10 h-10 border rounded-lg transition-all flex items-center justify-center ${showFindReplace ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
                    title="Find & Replace"
                  >
                    <i className="fa-solid fa-repeat"></i>
                  </button>
                  <button
                    onClick={() => setShowColumnManager(!showColumnManager)}
                    className="p-2 w-10 h-10 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center"
                    title="Manage Columns"
                  >
                    <i className="fa-solid fa-columns"></i>
                  </button>
                  <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>
                  <button
                    onClick={handleAddRow}
                    className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    title="Add New Row"
                  >
                    + Row
                  </button>
                  <div className="relative group">
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-md flex items-center gap-2" title="Export Data">
                      <i className="fa-solid fa-download"></i> Export <i className="fa-solid fa-chevron-down text-[10px]"></i>
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <button onClick={() => handleExport('dbf')} className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 font-medium text-slate-700 dark:text-slate-300 first:rounded-t-xl">Original (.dbf)</button>
                      <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 font-medium text-slate-700 dark:text-slate-300">Spreadsheet (.csv)</button>
                      <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 font-medium text-slate-700 dark:text-slate-300 last:rounded-b-xl">Data (.json)</button>
                    </div>
                  </div>
                  <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>
                  <button
                    onClick={() => setShowInfo(true)}
                    className="p-2 w-10 h-10 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center"
                    title="Info & Shortcuts (?)"
                  >
                    <i className="fa-solid fa-circle-info"></i>
                  </button>
                  <div className="ml-3 text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-mono">Ctrl</kbd>
                    <span className="text-slate-300 dark:text-slate-600">+</span>
                    <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-mono">/</kbd>
                    <span className="ml-1">shortcuts</span>
                  </div>
                </>
              )}
              
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 w-10 h-10 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center"
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
              </button>

              <input type="file" ref={fileInputRef} className="hidden" accept=".dbf" multiple onChange={handleFileUpload} />
              <button
                onClick={handleOpenFilesClick}
                className={`p-2 w-10 h-10 rounded-lg transition-all flex items-center justify-center ${tabs.length === 0 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                title="Upload DBF Files"
              >
                <i className="fa-solid fa-folder-plus"></i>
              </button>
              
              {activeTab && (
                <button
                  onClick={() => setHeaderVisible(false)}
                  className="p-2 w-10 h-10 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all flex items-center justify-center"
                  title="Hide Header (Zen Mode)"
                >
                  <i className="fa-solid fa-compress"></i>
                </button>
              )}
            </div>
          </header>
        )}

        {tabs.length > 0 && (
          <div className="relative bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 z-20 shrink-0 transition-all overflow-hidden">
            <div className={`flex ${headerVisible ? 'px-8 pt-2' : 'px-4 pt-2'} gap-1 overflow-x-auto overflow-y-hidden`}>
              {tabs.map((tab, idx) => {
                const shouldShow = !hideNonMatchingTabs || !searchTerm.trim() || globalSearchResults.has(idx);
                if (!shouldShow) return null;
              const hasGlobalSearchMatch = globalSearchResults.has(idx);
              const isActive = activeTabIndex === idx;

              return (
                <div key={tab.id} onClick={() => setActiveTabIndex(idx)} onContextMenu={(e) => handleTabContextMenu(e, idx)}
                  className={`group flex items-center gap-2 px-4 py-2 rounded-t-lg text-xs font-semibold cursor-pointer transition-all border-x border-t relative
                    ${isActive ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm translate-y-[1px]' : 'bg-transparent border-transparent text-slate-500 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-900'}
                    ${hasGlobalSearchMatch && !isActive ? 'ring-2 ring-emerald-400 ring-opacity-60 bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 animate-in fade-in duration-300' : ''}`}>
                  <span className="max-w-[150px] truncate">{tab.fileName}</span>
                  {hasGlobalSearchMatch && (
                    <span className="ml-1 px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] rounded-full font-bold animate-in fade-in zoom-in-95 duration-300 flex items-center justify-center">
                      <i className="fa-solid fa-search text-[6px]"></i>
                    </span>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); closeTab(idx); }} className="ml-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* Tab Context Menu */}
        {tabContextMenu.isOpen && (
          <div
            className="fixed z-[100] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-2 min-w-[180px]"
            style={{ left: tabContextMenu.x, top: tabContextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { closeTab(tabContextMenu.tabIndex); }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 flex items-center gap-3"
            >
              <i className="fa-solid fa-xmark text-red-500"></i>
              Close Tab
            </button>
            <button
              onClick={closeAllTabs}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 flex items-center gap-3"
            >
              <i className="fa-solid fa-xmark text-red-500"></i>
              Close All Tabs
            </button>
            <button
              onClick={() => closeOtherTabs(tabContextMenu.tabIndex)}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 flex items-center gap-3"
            >
              <i className="fa-solid fa-xmark text-red-500"></i>
              Close Other Tabs
            </button>
            <button
              onClick={() => closeTabsToRight(tabContextMenu.tabIndex)}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 flex items-center gap-3"
            >
              <i className="fa-solid fa-arrow-right text-slate-500"></i>
              Close Tabs to Right
            </button>
            <button
              onClick={() => closeTabsToLeft(tabContextMenu.tabIndex)}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 flex items-center gap-3"
            >
              <i className="fa-solid fa-arrow-left text-slate-500"></i>
              Close Tabs to Left
            </button>
          </div>
        )}

        {activeTab && headerVisible && (
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-2 flex flex-col z-20 transition-all">
            <div className="flex items-center gap-6 overflow-x-auto whitespace-nowrap pb-1">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-layer-group text-slate-400 text-[10px]"></i>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest">Slicer</span>
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg gap-1">
                {['all', 'first', 'last', 'range'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setRangeFilter(prev => ({ ...prev, mode: mode as any }))}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${rangeFilter.mode === mode ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700'}`}
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
                    className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none dark:text-slate-300"
                  />
                </div>
              )}
              <div className="ml-auto text-[10px] text-slate-400 font-medium">
                Active Records: <span className="text-slate-800 dark:text-slate-300 font-bold">{visibleData?.rows.length ?? 0}</span>
                <span className="mx-2 opacity-50">|</span>
                Total: <span className="text-slate-800 dark:text-slate-300 font-bold">{activeTab.rows.length}</span>
              </div>
            </div>

            {queryConditions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-50 dark:border-slate-800 animate-in fade-in">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">Active Queries:</span>
                {queryConditions.map(cond => (
                  <div key={cond.id} className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 px-2 py-1 rounded-md">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{cond.field}</span>
                    <span className="text-[9px] text-indigo-400 uppercase font-bold italic">{cond.operator}</span>
                    <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300">"{cond.value}"</span>
                    <button onClick={() => removeQueryCondition(cond.id)} className="ml-1 text-indigo-300 hover:text-red-500 transition-colors">
                      <i className="fa-solid fa-circle-xmark"></i>
                    </button>
                  </div>
                ))}
                <button onClick={() => setQueryConditions([])} className="text-[9px] font-bold text-red-500 uppercase hover:underline ml-2">Clear All</button>
              </div>
            )}
          </div>
        )}

        <div className={`flex-1 overflow-hidden relative flex flex-col transition-all duration-300 ${headerVisible && tabs.length > 0 ? 'p-8' : 'p-2'}`}>
          {showQueryBuilder && activeTab && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[400px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Add Filter Logic</h3>
                <button onClick={() => setShowQueryBuilder(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Field</label>
                    <select 
                      value={newCondition.field} 
                      onChange={e => setNewCondition(prev => ({ ...prev, field: e.target.value }))}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-200 outline-none"
                    >
                      <option value="">Select Field...</option>
                      {activeTab.header.fields.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Operator</label>
                    <select 
                      value={newCondition.operator} 
                      onChange={e => setNewCondition(prev => ({ ...prev, operator: e.target.value as any }))}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-200 outline-none"
                    >
                      <option value="contains">Contains</option>
                      <option value="equals">Equals</option>
                      <option value="starts">Starts With</option>
                      <option value="gt">Greater Than</option>
                      <option value="lt">Less Than</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Value</label>
                  <input 
                    placeholder="Value to match..." 
                    value={newCondition.value} 
                    onChange={e => setNewCondition(prev => ({ ...prev, value: e.target.value }))} 
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-200" 
                  />
                </div>
                <button 
                  onClick={addQueryCondition}
                  disabled={!newCondition.field || !newCondition.value}
                  className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 ${!newCondition.field || !newCondition.value ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                  Apply Logic
                </button>
              </div>
            </div>
          )}

          {showFindReplace && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Find & Replace All</h3>
                <button onClick={() => setShowFindReplace(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Find Text</label>
                  <input placeholder="Text to search for..." value={frFind} onChange={e => setFrFind(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-200" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Replace With</label>
                  <input placeholder="Replacement text..." value={frReplace} onChange={e => setFrReplace(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-200" />
                </div>
                <button 
                  onClick={handleFindReplaceTrigger} 
                  disabled={!frFind}
                  className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 ${!frFind ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                  Apply Replacement
                </button>
              </div>
            </div>
          )}

          {showColumnManager && activeTab && (
            <div className="absolute top-4 right-12 z-40 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Layout Engine</h3>
                <button onClick={() => setShowColumnManager(false)}><i className="fa-solid fa-xmark text-slate-400"></i></button>
              </div>
<div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    setTabs(prev => {
                      const newTabs = [...prev];
                      const tab = { ...newTabs[activeTabIndex] };
                      tab.hiddenColumns = [];
                      newTabs[activeTabIndex] = tab;
                      return newTabs;
                    });
                  }}
                  className="flex-1 px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => {
                    setTabs(prev => {
                      const newTabs = [...prev];
                      const tab = { ...newTabs[activeTabIndex] };
                      tab.hiddenColumns = activeTab.header.fields.map(f => f.name);
                      newTabs[activeTabIndex] = tab;
                      return newTabs;
                    });
                  }}
                  className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {activeTab.header.fields.map(field => {
                  // Check if column contains all null values
                  const isAllNullColumn = activeTab.rows.every(row => row[field.name] === null || row[field.name] === undefined || row[field.name] === '');
                  
                  return (
                    <label key={field.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors group">
                      <input 
                        type="checkbox" 
                        checked={!activeTab.hiddenColumns.includes(field.name)} 
                        onChange={() => toggleColumnVisibility(field.name)} 
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 transition-all" 
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{field.name}</span>
                        {isAllNullColumn && (
                          <span className="text-[10px] text-amber-500 dark:text-amber-400 ml-1">
                            (All null values)
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {status === AppStatus.IDLE && tabs.length === 0 && (
            <div className="h-full overflow-y-auto flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500 py-4 pt-12">
              <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl shadow-indigo-100/50 dark:shadow-indigo-900/10">
                <i className="fa-solid fa-database text-4xl text-indigo-500"></i>
              </div>
              <h2 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 mb-3 uppercase tracking-tighter">DBF Nexus Online Studio</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-6 font-medium">The ultimate browser-based power tool for dBase tables. Securely view and edit DBF files with virtualized scroll, multi-format exports, and professional metadata analysis. 100% client-side processing - no data sent to servers.</p>
              <div className="flex flex-col items-center gap-6 mt-8">
                <button onClick={handleOpenFilesClick} className="px-10 py-5 bg-indigo-600 text-white rounded-3xl font-black shadow-2xl shadow-indigo-300 dark:shadow-indigo-900/30 hover:bg-indigo-700 hover:-translate-y-1 active:scale-95 transition-all uppercase tracking-widest text-xs">
                  SELECT DBF FILE
                </button>
                <div className="flex items-center gap-3 text-slate-400 text-sm font-bold">
                  <i className="fa-solid fa-cloud-arrow-up text-indigo-400 animate-bounce"></i>
                  <span>Or just drag and drop anywhere</span>
                </div>
                <div className="flex items-center gap-4 text-slate-400 text-sm">
                  <button
                    onClick={() => setShowInfo(true)}
                    className="flex items-center gap-2 hover:text-indigo-500 transition-colors"
                    title="Show Info & Shortcuts (?)"
                  >
                    <i className="fa-solid fa-circle-info"></i>
                    <span>Info & Shortcuts</span>
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <span>Press <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">?</kbd> for help</span>
                </div>
                <div className="mt-4 w-full max-w-5xl text-left mb-2">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">Features</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold mb-2"><i className="fa-solid fa-layer-group text-indigo-500"></i> Multi-file tabs</div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Open multiple DBF files and switch across tabs, tabs remain visible in fullscreen.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold mb-2"><i className="fa-solid fa-bolt text-amber-500"></i> Live updates</div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Detect background file changes, highlight updated cells, hover to see old values.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold mb-2"><i className="fa-solid fa-filter text-indigo-500"></i> Query builder & slicer</div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Add conditions and slice data (first, last, range) for targeted views.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold mb-2"><i className="fa-solid fa-repeat text-indigo-500"></i> Find & Replace</div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Bulk replace text across fields with confirmation.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold mb-2"><i className="fa-solid fa-columns text-indigo-500"></i> Column manager</div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Show or hide columns and adjust widths for a custom layout.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold mb-2"><i className="fa-solid fa-arrows-up-down text-indigo-500"></i> Virtualized table</div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Smooth scrolling with large datasets, context menu actions, and inline editing.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold mb-2"><i className="fa-solid fa-download text-indigo-500"></i> Export</div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Export to DBF, CSV, or JSON directly from the browser.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold mb-2"><i className="fa-solid fa-moon text-indigo-500"></i> Dark mode</div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Toggle light/dark theme and remember preference.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold mb-2"><i className="fa-solid fa-mouse-pointer text-indigo-500"></i> Context Menus</div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Right-click rows and columns for quick actions and operations.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold mb-2"><i className="fa-solid fa-keyboard text-indigo-500"></i> Keyboard Shortcuts</div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Full keyboard navigation with shortcuts for common actions.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold mb-2"><i className="fa-solid fa-plus text-indigo-500"></i> Row Operations</div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Insert, duplicate, and delete rows with confirmation dialogs.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold mb-2"><i className="fa-solid fa-compress text-indigo-500"></i> Zen Mode</div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Distraction-free interface by hiding header and sidebar.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold mb-2"><i className="fa-solid fa-palette text-indigo-500"></i> Type-Aware Display</div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Color-coded rendering for numbers, dates, and boolean values.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold mb-2"><i className="fa-solid fa-computer text-green-500"></i> Client-Side Processing</div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">100% browser-based - no servers, no uploads, complete privacy.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {visibleData && (
            <div className="h-full flex flex-col animate-in slide-in-from-bottom-4 duration-700">
               {/* Warning if columns with all null values are hidden */}
               {(() => {
                 const allNullColumns = activeTab.header.fields.filter(field =>
                   activeTab.rows.every(row => row[field.name] === null || row[field.name] === undefined || row[field.name] === '')
                 );

                 if (allNullColumns.length > 0 && showNullColumnWarning) {
                   return (
                     <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-3">
                       <i className="fa-solid fa-exclamation-triangle text-amber-600 dark:text-amber-500 text-lg"></i>
                       <div className="flex-1">
                         <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                           {allNullColumns.length} column(s) hidden due to all null values
                         </p>
                         <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                           Click "Manage Columns" to view and toggle visibility of: {allNullColumns.map(f => f.name).join(', ')}
                         </p>
                       </div>
                       <button onClick={() => setShowNullColumnWarning(false)} className="text-amber-600 hover:text-amber-800 dark:text-amber-500 dark:hover:text-amber-300">
                         <i className="fa-solid fa-xmark"></i>
                       </button>
                     </div>
                   );
                 }
                 return null;
               })()}
               
               <div className="flex-1 min-h-0 relative">
                  <VirtualTable
                    data={visibleData}
                    searchTerm={searchTerm}
                    selectedRowIndex={currentSelectedRowIndex}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    onEdit={handleEdit}
                    onDeleteRow={handleDeleteRow}
                    onSelectRow={handleSelectRow}
                    onInsertRow={handleInsertRow}
                    onDuplicateRow={handleDuplicateRow}
                    onHideColumn={toggleColumnVisibility}
                    />
               </div>
            </div>
          )}
        </div>
      </main>

      {sidebarVisible && activeTab && (
        <div className="relative flex">
           {/* Sidebar Toggle Handle */}
           <button 
             onClick={() => setSidebarVisible(false)}
             className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg flex items-center justify-center text-slate-400 hover:text-indigo-500 z-50 transition-all hover:scale-110 active:scale-90"
             title="Hide Sidebar"
           >
             <i className="fa-solid fa-chevron-right"></i>
           </button>
           <Sidebar 
             data={activeTab} 
             selectedRowIndex={currentSelectedRowIndex} 
           />
        </div>
      )}
    </div>
  );
};

export default App;
