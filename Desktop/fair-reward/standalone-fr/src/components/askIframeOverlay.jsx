import React from 'react';

export default function TaskIframeOverlay({ url, title, onClose }) {
  if (!url) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col">
      <div className="h-16 bg-slate-900 border-b border-slate-800 text-white flex justify-between items-center px-6 shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
          <div className="min-w-0">
            <span className="font-bold text-sm text-white block truncate">{title}</span>
            <span className="text-[10px] text-slate-400 block uppercase tracking-widest">Connessione Protetta</span>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all whitespace-nowrap"
        >
          Chiudi e Torna
        </button>
      </div>
      <iframe 
        src={url} 
        className="w-full flex-1 border-none bg-slate-950"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title={title}
      />
    </div>
  );
}