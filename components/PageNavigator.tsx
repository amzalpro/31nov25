import React from 'react';
import { Page, PageType } from '../types';
import { Plus, Trash2, Copy, FileText, LayoutTemplate, File, Book, ToggleLeft, ToggleRight, ListOrdered } from 'lucide-react';

interface PageNavigatorProps {
  pages: Page[];
  currentPageId: string;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onDeletePage: (id: string) => void;
  onDuplicatePage: (id: string) => void;
  onToggleStructure: (type: PageType) => void;
}

export const PageNavigator: React.FC<PageNavigatorProps> = ({
  pages,
  currentPageId,
  onSelectPage,
  onAddPage,
  onDeletePage,
  onDuplicatePage,
  onToggleStructure
}) => {
  // Helper to check if types exist
  const hasCover = pages.some(p => p.type === 'cover');
  const hasWhitePage = pages.some(p => p.type === 'white');
  const hasSummary = pages.some(p => p.type === 'summary');
  const hasBackCover = pages.some(p => p.type === 'back_cover');

  // Helper for numbering
  let standardPageCounter = 0;

  return (
    <div className="fixed left-0 top-0 bottom-0 w-40 bg-white border-r border-slate-200 flex flex-col z-40 shadow-sm no-print">
      {/* Structure Toggles */}
      <div className="p-3 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
         <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Book size={12} /> Structure
         </h3>
         
         <div className="flex flex-col gap-2">
             <button 
                onClick={() => onToggleStructure('cover')}
                className="flex items-center justify-between text-xs text-slate-700 hover:text-indigo-600 transition-colors"
             >
                <span className="flex items-center gap-2"><LayoutTemplate size={12} /> Couverture</span>
                {hasCover ? <ToggleRight size={18} className="text-indigo-600" /> : <ToggleLeft size={18} className="text-slate-300" />}
             </button>

             <button 
                onClick={() => onToggleStructure('white')}
                className="flex items-center justify-between text-xs text-slate-700 hover:text-indigo-600 transition-colors"
             >
                <span className="flex items-center gap-2"><File size={12} /> Page Garde</span>
                {hasWhitePage ? <ToggleRight size={18} className="text-indigo-600" /> : <ToggleLeft size={18} className="text-slate-300" />}
             </button>

             <button 
                onClick={() => onToggleStructure('summary')}
                className="flex items-center justify-between text-xs text-slate-700 hover:text-indigo-600 transition-colors"
             >
                <span className="flex items-center gap-2"><ListOrdered size={12} /> Sommaire</span>
                {hasSummary ? <ToggleRight size={18} className="text-indigo-600" /> : <ToggleLeft size={18} className="text-slate-300" />}
             </button>

             <button 
                onClick={() => onToggleStructure('back_cover')}
                className="flex items-center justify-between text-xs text-slate-700 hover:text-indigo-600 transition-colors"
             >
                <span className="flex items-center gap-2"><LayoutTemplate size={12} /> 4ème Couv.</span>
                {hasBackCover ? <ToggleRight size={18} className="text-indigo-600" /> : <ToggleLeft size={18} className="text-slate-300" />}
             </button>
         </div>
      </div>

      <div className="p-2 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <FileText size={12} /> Contenu
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4 scrollbar-thin">
        {pages.map((page, index) => {
          let label = "";
          if (page.type === 'cover') label = "Couverture";
          else if (page.type === 'white') label = "Page de Garde";
          else if (page.type === 'summary') label = "Sommaire";
          else if (page.type === 'back_cover') label = "4ème de Couv.";
          else {
              standardPageCounter++;
              label = `Page ${standardPageCounter}`;
          }

          return (
            <div 
                key={page.id} 
                onClick={() => onSelectPage(page.id)}
                className={`relative group cursor-pointer transition-all duration-200 ${page.id === currentPageId ? 'scale-105' : 'hover:scale-102'}`}
            >
                <div className="flex justify-between items-center mb-1 px-1">
                    <span className={`text-xs font-medium ${page.id === currentPageId ? 'text-indigo-600' : 'text-slate-500'}`}>
                        {label}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {page.type === 'standard' && (
                            <>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDuplicatePage(page.id); }}
                                    className="text-slate-400 hover:text-indigo-500 p-0.5 rounded"
                                    title="Dupliquer"
                                >
                                    <Copy size={12} />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeletePage(page.id); }}
                                    className="text-slate-400 hover:text-red-500 p-0.5 rounded"
                                    title="Supprimer"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
                
                {/* Thumbnail Representation */}
                <div className={`aspect-[210/297] w-full bg-white shadow-sm border rounded-md overflow-hidden relative ${page.id === currentPageId ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="absolute inset-0 bg-slate-50/30 pointer-events-none">
                        {/* Special Backgrounds for Types */}
                        {page.type === 'cover' && <div className="absolute inset-0 bg-indigo-50/50 flex items-center justify-center text-[8px] text-indigo-300 font-bold uppercase tracking-widest -rotate-45">Couverture</div>}
                        {page.type === 'back_cover' && <div className="absolute inset-0 bg-slate-100/50 flex items-center justify-center text-[8px] text-slate-300 font-bold uppercase tracking-widest -rotate-45">Fin</div>}
                        {page.type === 'summary' && <div className="absolute inset-0 bg-white flex items-center justify-center text-[8px] text-slate-400 font-bold uppercase tracking-widest -rotate-45 border-4 border-double border-slate-100">Sommaire</div>}
                        
                        {/* Mini element representation */}
                        {(page.elements || []).map(el => (
                            <div 
                                key={el.id}
                                className="absolute bg-slate-300/50 border border-slate-400/20 rounded-[1px]"
                                style={{
                                    left: `${(el.x / 794) * 100}%`,
                                    top: `${(el.y / 1123) * 100}%`,
                                    width: `${(el.width / 794) * 100}%`,
                                    height: `${(el.height / 1123) * 100}%`,
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-slate-100 bg-slate-50">
        <button 
          onClick={onAddPage}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
        >
          <Plus size={14} /> Nouvelle Page
        </button>
      </div>
    </div>
  );
};