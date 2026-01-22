
import React, { useState, useMemo } from 'react';
import { DBFData } from '../types';
import { analyzeData } from '../services/geminiService';

interface SidebarProps {
  data: DBFData | null;
  selectedRowIndex: number | null;
  hasApiKey: boolean;
  onSelectKey: () => void;
  setHasApiKey: (val: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ data, selectedRowIndex, hasApiKey, onSelectKey, setHasApiKey }) => {
  const [activeMode, setActiveMode] = useState<'ai' | 'inspector' | 'stats'>('inspector');
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!data) return;
    setLoading(true);
    try {
      const result = await analyzeData(data);
      if (result.includes("Requested entity was not found")) {
        // Reset key selection if invalid key detected as per platform rules
        setHasApiKey(false);
      }
      setAnalysis(result);
    } catch (err) {
      setAnalysis("An unexpected error occurred during analysis.");
    } finally {
      setLoading(false);
    }
  };

  const selectedRow = selectedRowIndex !== null && data ? data.rows[selectedRowIndex] : null;

  const renderValue = (val: any, type: string) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-slate-300 italic text-xs">empty / null</span>;
    }
    
    const typeUpper = type.toUpperCase();
    if (['N', 'F', 'I', 'B', 'Y'].includes(typeUpper)) {
      return <span className="text-blue-600 font-mono font-bold text-sm bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">{val.toString()}</span>;
    }
    if (typeUpper === 'D' || typeUpper === 'T') {
      return (
        <span className="text-emerald-700 font-semibold text-sm bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 flex items-center gap-1.5 w-fit">
          <i className="fa-regular fa-calendar-check text-[10px]"></i>
          {val.toString()}
        </span>
      );
    }
    if (typeUpper === 'L') {
      return (
        <span className={`px-2 py-1 rounded-lg text-[10px] font-black border ${val ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
          {val ? 'TRUE' : 'FALSE'}
        </span>
      );
    }
    return <span className="text-slate-700 font-medium leading-relaxed">{val.toString()}</span>;
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
    <div className="w-96 h-full border-l border-slate-200 bg-white flex flex-col overflow-hidden shadow-2xl z-40">
      <div className="flex border-b border-slate-100 shrink-0">
        <button 
          onClick={() => setActiveMode('inspector')}
          className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2
            ${activeMode === 'inspector' ? 'border-indigo-500 text-indigo-600 bg-indigo-50/20' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <i className="fa-solid fa-eye mr-1.5"></i> Inspector
        </button>
        <button 
          onClick={() => setActiveMode('stats')}
          className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2
            ${activeMode === 'stats' ? 'border-indigo-500 text-indigo-600 bg-indigo-50/20' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <i className="fa-solid fa-chart-line mr-1.5"></i> Stats
        </button>
        <button 
          onClick={() => setActiveMode('ai')}
          className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2
            ${activeMode === 'ai' ? 'border-indigo-500 text-indigo-600 bg-indigo-50/20' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <i className="fa-solid fa-sparkles mr-1.5"></i> AI Insights
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeMode === 'inspector' && (
          <div className="h-full">
            <h2 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <i className="fa-solid fa-magnifying-glass-chart text-indigo-500"></i>
              Data Inspector
            </h2>

            {selectedRow ? (
              <div className="space-y-6">
                <div className="bg-indigo-600 rounded-2xl p-5 text-white shadow-xl shadow-indigo-100 mb-8 relative overflow-hidden">
                   <div className="relative z-10">
                     <p className="text-[10px] text-indigo-200 font-black uppercase mb-1 tracking-widest">Selected Row</p>
                     <p className="text-3xl font-black italic">#{selectedRowIndex! + 1}</p>
                   </div>
                   <i className="fa-solid fa-hashtag absolute -right-4 -bottom-4 text-7xl text-indigo-500/30"></i>
                </div>
                {data?.header.fields.map(field => (
                  <div key={field.name} className="group pb-4 border-b border-slate-50 last:border-none hover:bg-slate-50/50 p-2 rounded-xl transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{field.name}</span>
                      <span className="text-[9px] px-2 py-0.5 bg-slate-100 rounded-full font-bold text-slate-500 border border-slate-200">TYPE {field.type}</span>
                    </div>
                    <div className="min-h-[1.5rem] flex items-center">
                      {renderValue(selectedRow[field.name], field.type)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-40">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                  <i className="fa-solid fa-hand-pointer text-3xl text-slate-300"></i>
                </div>
                <p className="text-slate-500 font-bold">Select a row to begin inspection</p>
                <p className="text-slate-400 text-xs mt-1">Detailed field data will appear here</p>
              </div>
            )}
          </div>
        )}

        {activeMode === 'stats' && (
          <div className="h-full">
            <h2 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <i className="fa-solid fa-calculator text-indigo-500"></i>
              Dynamic Statistics
            </h2>
            
            {stats.length > 0 ? (
              <div className="space-y-6">
                {stats.map(s => s && (
                  <div key={s.name} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="text-xs font-black text-slate-800 mb-4 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                      {s.name}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Average</p>
                        <p className="text-sm font-black text-indigo-600">{s.avg}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Sum</p>
                        <p className="text-sm font-black text-slate-700">{s.sum}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Min</p>
                        <p className="text-sm font-black text-slate-700">{s.min}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Max</p>
                        <p className="text-sm font-black text-slate-700">{s.max}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-40">
                <i className="fa-solid fa-chart-line text-5xl text-slate-200 mb-6"></i>
                <p className="text-slate-500 font-bold">No numeric data available</p>
              </div>
            )}
          </div>
        )}

        {activeMode === 'ai' && (
          <div className="h-full">
            <h2 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <i className="fa-solid fa-robot text-indigo-500"></i>
              Nexus AI Engine
            </h2>

            {!hasApiKey && (
              <div className="flex flex-col items-center justify-center text-center p-4 py-20 animate-in fade-in">
                <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6 text-indigo-400">
                  <i className="fa-solid fa-key text-4xl"></i>
                </div>
                <h3 className="text-slate-800 font-black mb-3 text-sm">API Key Required</h3>
                <p className="text-slate-500 text-xs mb-8 leading-relaxed">
                  To use AI Insights, you must select your own paid Google Gemini API key.
                  <br />
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-indigo-600 hover:underline font-bold">Learn about billing</a>
                </p>
                <button
                  onClick={onSelectKey}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-black shadow-lg hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
                >
                  <i className="fa-solid fa-plug"></i> Connect API Key
                </button>
              </div>
            )}

            {hasApiKey && !analysis && !loading && (
              <div className="flex flex-col items-center justify-center text-center p-4 py-20 animate-in fade-in">
                <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6 text-indigo-200">
                  <i className="fa-solid fa-brain text-4xl"></i>
                </div>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                  Analyze current patterns, anomalies, and schema quality using Gemini Pro.
                </p>
                <button
                  onClick={handleAnalyze}
                  disabled={!data}
                  className={`px-8 py-3 rounded-xl text-sm font-black shadow-lg transition-all active:scale-95
                    ${!data ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                  START ANALYSIS
                </button>
                <button onClick={onSelectKey} className="mt-4 text-[10px] text-slate-400 hover:text-indigo-600 font-bold uppercase tracking-widest">
                  Change API Key
                </button>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="relative mb-6">
                   <div className="w-16 h-16 border-4 border-indigo-100 rounded-full"></div>
                   <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0"></div>
                </div>
                <p className="text-slate-600 font-black text-xs uppercase tracking-widest animate-pulse">Consulting Gemini...</p>
              </div>
            )}

            {analysis && !loading && (
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
                <div className="prose prose-sm text-slate-600 max-w-none">
                  {analysis.split('\n').map((line, i) => {
                    if (line.startsWith('#')) return <h3 key={i} className="text-indigo-800 font-black mt-6 mb-2 text-sm uppercase tracking-wider">{line.replace(/#/g, '').trim()}</h3>;
                    return <p key={i} className="mb-3 leading-relaxed text-sm">{line}</p>;
                  })}
                </div>
                <button 
                  onClick={() => setAnalysis('')} 
                  className="mt-8 w-full py-3 bg-white border border-slate-200 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-rotate-left"></i> Run New Analysis
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
           <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">System Ready</span>
        </div>
        <span className="text-[10px] text-slate-300 font-mono">v2.5.2-DYNAMIC-KEY</span>
      </div>
    </div>
  );
};

export default Sidebar;
