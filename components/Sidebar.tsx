
import React, { useState, useMemo } from 'react';
import { DBFData } from '../types';

interface SidebarProps {
  data: DBFData | null;
  selectedRowIndex: number | null;
}

const Sidebar: React.FC<SidebarProps> = ({ data, selectedRowIndex }) => {
  const [activeMode, setActiveMode] = useState<'inspector' | 'stats' | 'schema'>('inspector');

  const selectedRow = selectedRowIndex !== null && data ? data.rows[selectedRowIndex] : null;

  const getDbfVersionName = (version: number) => {
    switch (version) {
      case 0x03: return "dBase III / FoxPro";
      case 0x04: return "dBase IV (no SQL)";
      case 0x05: return "dBase V";
      case 0x30: return "Visual FoxPro";
      case 0x31: return "Visual FoxPro (autoincrement)";
      case 0x83: return "dBase III+ with Memo";
      case 0x8B: return "dBase IV with Memo";
      case 0xF5: return "FoxPro with Memo";
      default: return `Unknown (0x${version.toString(16)})`;
    }
  };

  const renderValue = (val: any, type: string) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-slate-300 dark:text-slate-600 italic text-xs">empty / null</span>;
    }
    
    const typeUpper = type.toUpperCase();
    if (['N', 'F', 'I', 'B', 'Y'].includes(typeUpper)) {
      return <span className="text-blue-600 dark:text-blue-400 font-mono font-bold text-sm bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-800/50">{val.toString()}</span>;
    }
    if (typeUpper === 'D' || typeUpper === 'T') {
      return (
        <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-sm bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-800/50 flex items-center gap-1.5 w-fit">
          <i className="fa-regular fa-calendar-check text-[10px]"></i>
          {val.toString()}
        </span>
      );
    }
    if (typeUpper === 'L') {
      return (
        <span className={`px-2 py-1 rounded-lg text-[10px] font-black border ${val ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'}`}>
          {val ? 'TRUE' : 'FALSE'}
        </span>
      );
    }
    return <span className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{val.toString()}</span>;
  };

  const stats = useMemo(() => {
    if (!data) return [];
    const numericFields = data.header.fields.filter(f => ['N', 'F', 'I', 'B', 'Y'].includes(f.type.toUpperCase()));
    
    return numericFields.map(field => {
      const values = data.rows.map(r => Number(r[field.name])).filter(v => !isNaN(v));
      if (values.length === 0) return null;
      
      const sum = values.reduce((a, b) => a + b, 0);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = sum / values.length;

      return {
        name: field.name,
        sum: sum.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        min: min.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        max: max.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        avg: avg.toLocaleString(undefined, { maximumFractionDigits: 2 })
      };
    }).filter(Boolean);
  }, [data]);

  return (
    <div className="w-96 h-full border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden shadow-2xl z-40 transition-colors">
      <div className="flex border-b border-slate-100 dark:border-slate-800 shrink-0">
        <button 
          onClick={() => setActiveMode('inspector')}
          className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2
            ${activeMode === 'inspector' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/20 dark:bg-indigo-900/10' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
          <i className="fa-solid fa-eye mr-1.5"></i> Inspector
        </button>
        <button 
          onClick={() => setActiveMode('stats')}
          className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2
            ${activeMode === 'stats' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/20 dark:bg-indigo-900/10' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
          <i className="fa-solid fa-chart-line mr-1.5"></i> Stats
        </button>
        <button 
          onClick={() => setActiveMode('schema')}
          className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2
            ${activeMode === 'schema' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/20 dark:bg-indigo-900/10' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
          <i className="fa-solid fa-sitemap mr-1.5"></i> Schema
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeMode === 'inspector' && (
          <div className="h-full">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
              <i className="fa-solid fa-magnifying-glass-chart text-indigo-500"></i>
              Data Inspector
            </h2>

            {selectedRow ? (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-indigo-600 rounded-2xl p-5 text-white shadow-xl shadow-indigo-100 dark:shadow-indigo-950/20 mb-8 relative overflow-hidden">
                   <div className="relative z-10">
                     <p className="text-[10px] text-indigo-200 font-black uppercase mb-1 tracking-widest">Selected Row</p>
                     <p className="text-3xl font-black italic">#{selectedRowIndex! + 1}</p>
                   </div>
                   <i className="fa-solid fa-hashtag absolute -right-4 -bottom-4 text-7xl text-indigo-500/30"></i>
                </div>
                {data?.header.fields.map(field => (
                  <div key={field.name} className="group pb-4 border-b border-slate-50 dark:border-slate-800/50 last:border-none hover:bg-slate-50/50 dark:hover:bg-slate-800/30 p-2 rounded-xl transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{field.name}</span>
                      <span className="text-[9px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">TYPE {field.type}</span>
                    </div>
                    <div className="min-h-[1.5rem] flex items-center">
                      {renderValue(selectedRow[field.name], field.type)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-40">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                  <i className="fa-solid fa-hand-pointer text-3xl text-slate-300 dark:text-slate-600"></i>
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-bold">Select a row to begin inspection</p>
                <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Detailed field data will appear here</p>
              </div>
            )}
          </div>
        )}

        {activeMode === 'stats' && (
          <div className="h-full">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
              <i className="fa-solid fa-calculator text-indigo-500"></i>
              Dynamic Statistics
            </h2>
            
            {stats.length > 0 ? (
              <div className="space-y-6 animate-in fade-in">
                {stats.map(s => s && (
                  <div key={s.name} className="bg-white dark:bg-slate-850 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 mb-4 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                      {s.name}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-1">Average</p>
                        <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{s.avg}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-1">Sum</p>
                        <p className="text-sm font-black text-slate-700 dark:text-slate-200">{s.sum}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-1">Min</p>
                        <p className="text-sm font-black text-slate-700 dark:text-slate-200">{s.min}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-1">Max</p>
                        <p className="text-sm font-black text-slate-700 dark:text-slate-200">{s.max}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-40">
                <i className="fa-solid fa-chart-line text-5xl text-slate-200 dark:text-slate-800 mb-6"></i>
                <p className="text-slate-500 dark:text-slate-400 font-bold">No numeric data available</p>
              </div>
            )}
          </div>
        )}

        {activeMode === 'schema' && (
          <div className="h-full">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
              <i className="fa-solid fa-sitemap text-indigo-500"></i>
              Table Architecture
            </h2>

            {data ? (
              <div className="space-y-8 animate-in fade-in">
                <div className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
                   <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Header Metadata</h3>
                   <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 dark:text-slate-400">dBase Version</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded">{getDbfVersionName(data.header.version)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Last Updated</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{data.header.lastUpdate.toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Total Records</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{data.header.numberOfRecords.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Header Length</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">{data.header.headerLength} bytes</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Record Size</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">{data.header.recordLength} bytes</span>
                      </div>
                   </div>
                </div>

                <div>
                   <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                     <i className="fa-solid fa-list-check"></i>
                     Field Definitions ({data.header.fields.length})
                   </h3>
                   <div className="space-y-2">
                      {data.header.fields.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-700 rounded-xl hover:border-indigo-100 dark:hover:border-indigo-800 hover:shadow-sm transition-all group">
                           <span className="w-6 text-[10px] font-bold text-slate-300 dark:text-slate-600 group-hover:text-indigo-300">{i + 1}</span>
                           <div className="flex-1">
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{f.name}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Type: <span className="text-indigo-500 dark:text-indigo-400 font-bold">{f.type}</span> • Len: {f.length}{f.decimalCount > 0 && ` • Dec: ${f.decimalCount}`}</p>
                           </div>
                           <i className="fa-solid fa-circle-info text-slate-100 dark:text-slate-700 group-hover:text-slate-200 dark:group-hover:text-slate-600 transition-colors"></i>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-40">
                <i className="fa-solid fa-folder-open text-5xl text-slate-200 dark:text-slate-800 mb-6"></i>
                <p className="text-slate-500 dark:text-slate-400 font-bold">Load a file to view schema</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-2">
           <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
           <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-black">System Ready</span>
        </div>
        <span className="text-[10px] text-slate-300 dark:text-slate-600 font-mono">v3.0.0-DARK-QUERY</span>
      </div>
    </div>
  );
};

export default Sidebar;
