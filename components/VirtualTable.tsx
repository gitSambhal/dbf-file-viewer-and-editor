
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DBFData, DBFRow } from '../types';

interface VirtualTableProps {
  data: DBFData;
  searchTerm: string;
  selectedRowIndex: number | null;
  sortConfig: { key: string; direction: 'asc' | 'desc' | null };
  onSort: (key: string) => void;
  onEdit: (rowIndex: number, fieldName: string, value: any) => void;
  onDeleteRow: (originalIndex: number) => void;
  onSelectRow: (rowIndex: number) => void;
  onInsertRow: (index: number, position: 'above' | 'below') => void;
  onDuplicateRow: (index: number) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
  rowIndex: number | null;
}

const VirtualTable: React.FC<VirtualTableProps> = ({ 
  data, 
  searchTerm, 
  selectedRowIndex,
  sortConfig,
  onSort,
  onEdit, 
  onDeleteRow,
  onSelectRow,
  onInsertRow,
  onDuplicateRow
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, visible: false, rowIndex: null });
  const containerRef = useRef<HTMLDivElement>(null);
  const [tableHeight, setTableHeight] = useState(600);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(prev => ({ ...prev, visible: false }));
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleClickOutside, true);
    
    // Auto-resize table height based on parent container
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        // Leave room for header and footer in the table component
        const headerHeight = 42; // column headers
        const footerHeight = 42; // summary bar
        setTableHeight(entry.contentRect.height - headerHeight - footerHeight);
      }
    });

    if (containerRef.current?.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }

    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleClickOutside, true);
      resizeObserver.disconnect();
    };
  }, []);

  const handleEditSubmit = (rowIndex: number, fieldName: string, value: any) => {
    onEdit(rowIndex, fieldName, value);
    setEditingCell(null);
  };

  const handleContextMenu = (e: React.MouseEvent, originalIndex: number) => {
    e.preventDefault();
    onSelectRow(originalIndex);
    
    // Calculate position
    let x = e.clientX;
    let y = e.clientY;
    
    // Viewport bounds check
    if (x + 220 > window.innerWidth) x -= 220;
    if (y + 280 > window.innerHeight) y -= 280;

    setContextMenu({ x, y, visible: true, rowIndex: originalIndex });
  };

  const visibleFields = useMemo(() => {
    return data.header.fields.filter(f => !data.hiddenColumns.includes(f.name));
  }, [data.header.fields, data.hiddenColumns]);

  const filteredRows = useMemo(() => {
    let rows = data.rows.map((r, i) => ({ ...r, _originalIndex: i }));
    
    if (searchTerm) {
      const lowSearch = searchTerm.toLowerCase();
      rows = rows.filter(row => 
        Object.values(row).some(val => 
          val?.toString().toLowerCase().includes(lowSearch)
        )
      );
    }

    if (sortConfig.key && sortConfig.direction) {
      rows.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA === valB) return 0;
        const multiplier = sortConfig.direction === 'asc' ? 1 : -1;
        
        // Handle numeric sort vs string sort
        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
            return (numA - numB) * multiplier;
        }
        return (valA < valB ? -1 : 1) * multiplier;
      });
    }

    return rows;
  }, [data.rows, searchTerm, sortConfig]);

  const rowHeight = 48;
  const visibleRowsCount = Math.ceil(tableHeight / rowHeight);
  const totalHeight = filteredRows.length * rowHeight;
  
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
  const endIndex = Math.min(filteredRows.length, startIndex + visibleRowsCount + 4);
  
  const visibleRows = filteredRows.slice(startIndex, endIndex);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const copyRowJson = (index: number) => {
    const row = data.rows[index];
    navigator.clipboard.writeText(JSON.stringify(row, null, 2));
  };

  const renderValue = (val: any, type: string) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-slate-300 dark:text-slate-600 italic text-[10px]">null</span>;
    }
    
    const typeUpper = type.toUpperCase();
    if (['N', 'F', 'I', 'B', 'Y'].includes(typeUpper)) {
      return <span className="text-blue-600 dark:text-blue-400 font-mono font-medium">{val.toString()}</span>;
    }
    if (typeUpper === 'D' || typeUpper === 'T') {
      return <span className="text-emerald-600 dark:text-emerald-400 font-medium"><i className="fa-regular fa-clock mr-1 text-[10px]"></i>{val.toString()}</span>;
    }
    if (typeUpper === 'L') {
      return (
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${val ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'}`}>
          {val ? 'TRUE' : 'FALSE'}
        </span>
      );
    }
    return <span className="text-slate-700 dark:text-slate-300">{val.toString()}</span>;
  };

  const columnWidth = 180;
  const indexWidth = 60;
  const actionsWidth = 80;
  const totalWidth = indexWidth + visibleFields.length * columnWidth + actionsWidth;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-full animate-in fade-in duration-300 transition-colors">
      
      {/* Custom Context Menu */}
      {contextMenu.visible && contextMenu.rowIndex !== null && (
        <div 
          className="fixed z-[999] w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-1.5 animate-in fade-in scale-95 duration-150 origin-top-left flex flex-col"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-slate-50 dark:border-slate-700 mb-1">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Record #{contextMenu.rowIndex + 1}</p>
          </div>
          <ContextMenuItem icon="fa-eye" label="Inspect Details" onClick={() => { onSelectRow(contextMenu.rowIndex!); setContextMenu(prev => ({ ...prev, visible: false })); }} />
          <div className="h-[1px] bg-slate-100 dark:bg-slate-700 my-1 mx-2"></div>
          <ContextMenuItem icon="fa-arrow-up" label="Insert Above" onClick={() => { onInsertRow(contextMenu.rowIndex!, 'above'); setContextMenu(prev => ({ ...prev, visible: false })); }} />
          <ContextMenuItem icon="fa-arrow-down" label="Insert Below" onClick={() => { onInsertRow(contextMenu.rowIndex!, 'below'); setContextMenu(prev => ({ ...prev, visible: false })); }} />
          <ContextMenuItem icon="fa-clone" label="Duplicate Record" onClick={() => { onDuplicateRow(contextMenu.rowIndex!); setContextMenu(prev => ({ ...prev, visible: false })); }} />
          <div className="h-[1px] bg-slate-100 dark:bg-slate-700 my-1 mx-2"></div>
          <ContextMenuItem icon="fa-copy" label="Copy JSON Data" onClick={() => { copyRowJson(contextMenu.rowIndex!); setContextMenu(prev => ({ ...prev, visible: false })); }} />
          <ContextMenuItem icon="fa-trash-can" label="Delete Record" variant="danger" onClick={() => { onDeleteRow(contextMenu.rowIndex!); setContextMenu(prev => ({ ...prev, visible: false })); }} />
        </div>
      )}

      <div className="overflow-x-auto flex-1 flex flex-col">
        <div style={{ minWidth: totalWidth }} className="flex-1 flex flex-col">
          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-20 flex shrink-0 transition-colors">
             <div style={{ width: indexWidth }} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">#</div>
             {visibleFields.map(field => (
               <div 
                 key={field.name} 
                 style={{ width: columnWidth }} 
                 onClick={() => onSort(field.name)}
                 className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate shrink-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group flex items-center justify-between"
               >
                 <span className="truncate">
                    {field.name}
                    <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500 font-normal">({field.type})</span>
                 </span>
                 <span className="ml-2 text-indigo-400 transition-opacity">
                    {sortConfig.key === field.name ? (
                      sortConfig.direction === 'asc' ? <i className="fa-solid fa-sort-up"></i> : <i className="fa-solid fa-sort-down"></i>
                    ) : <i className="fa-solid fa-sort text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100"></i>}
                 </span>
               </div>
             ))}
             <div style={{ width: actionsWidth }} className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">Actions</div>
          </div>

          <div 
            ref={containerRef}
            onScroll={handleScroll}
            className="overflow-y-auto flex-1 bg-white dark:bg-slate-900 transition-colors"
            style={{ maxHeight: `${tableHeight}px` }}
          >
            <div style={{ height: `${totalHeight}px`, position: 'relative', width: '100%' }}>
              {visibleRows.map((row, idx) => {
                const actualIndex = startIndex + idx;
                const originalIndex = row._originalIndex;
                const isSelected = selectedRowIndex === originalIndex;
                
                return (
                  <div 
                    key={originalIndex}
                    onClick={() => onSelectRow(originalIndex)}
                    onContextMenu={(e) => handleContextMenu(e, originalIndex)}
                    className={`flex border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 group absolute left-0 right-0 cursor-pointer transition-colors
                      ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/10 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-800/50 z-10' : ''}`}
                    style={{ top: `${actualIndex * rowHeight}px`, height: `${rowHeight}px` }}
                  >
                    <div style={{ width: indexWidth }} className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500 shrink-0 self-center">{originalIndex + 1}</div>
                    {visibleFields.map(field => (
                      <div 
                        key={field.name} 
                        style={{ width: columnWidth }}
                        className="px-6 py-2 text-sm truncate self-center relative shrink-0"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingCell({ row: originalIndex, field: field.name });
                        }}
                      >
                        {editingCell?.row === originalIndex && editingCell?.field === field.name ? (
                          <input
                            autoFocus
                            className="absolute inset-0 w-full h-full px-6 py-2 bg-indigo-50 dark:bg-slate-800 border-2 border-indigo-500 outline-none text-sm font-medium dark:text-slate-100"
                            defaultValue={row[field.name]}
                            onBlur={(e) => handleEditSubmit(originalIndex, field.name, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEditSubmit(originalIndex, field.name, (e.target as HTMLInputElement).value);
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                          />
                        ) : (
                          renderValue(row[field.name], field.type)
                        )}
                      </div>
                    ))}
                    <div style={{ width: actionsWidth }} className="px-4 py-3 flex justify-center items-center shrink-0">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          e.preventDefault();
                          onDeleteRow(originalIndex); 
                        }}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all rounded-lg active:scale-90"
                        title="Delete record"
                      >
                        <i className="fa-solid fa-trash-can text-sm"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center shrink-0 z-10 transition-colors">
        <div className="flex items-center gap-4">
          <span className="font-bold">Showing {filteredRows.length} records</span>
          {searchTerm && <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-black text-[10px] uppercase">Search Active</span>}
          {sortConfig.key && <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded font-black text-[10px] uppercase">Sorted by {sortConfig.key}</span>}
        </div>
        <div className="flex gap-6">
          <span className="flex items-center gap-1.5"><i className="fa-solid fa-mouse-pointer text-[10px] text-indigo-400"></i> Right-click for more actions</span>
          <span className="flex items-center gap-1.5"><i className="fa-solid fa-i-cursor text-[10px] text-indigo-400"></i> Double-click cell to edit</span>
        </div>
      </div>
    </div>
  );
};

interface ContextMenuItemProps {
  icon: string;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

const ContextMenuItem: React.FC<ContextMenuItemProps> = ({ icon, label, onClick, variant = 'default' }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all
      ${variant === 'danger' ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30' : 'text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
  >
    <div className="w-5 flex justify-center">
      <i className={`fa-solid ${icon}`}></i>
    </div>
    <span>{label}</span>
  </button>
);

export default VirtualTable;
