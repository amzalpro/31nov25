
import React, { useState, useEffect } from 'react';
import { PageElement, ElementType, Page, PageBackground } from '../types';
import { Trash2, AlignLeft, AlignCenter, AlignRight, AlignJustify, Bold, Type as TypeIcon, Wand2, Code, Layers, ArrowUp, ArrowDown, Eraser, Square, Grid, FileText, MoreHorizontal, Link2, Palette, Sparkles, Loader2, ImagePlus, X, Ban } from 'lucide-react';
import { analyzeAndImproveText, generatePageTexture } from '../services/geminiService';

interface PropertiesPanelProps {
  elements: PageElement[]; // Changed from single element to array
  currentPage?: Page;
  onUpdate: (id: string, updates: Partial<PageElement>) => void;
  onDelete: (id: string) => void;
  onUpdatePage?: (id: string, updates: Partial<Page>) => void;
}

// Sub-component for Code Editing
const CodeEditor: React.FC<{ content: string; onChange: (val: string) => void }> = ({ content, onChange }) => {
    const [value, setValue] = useState(content);
    useEffect(() => { if (content !== value) setValue(content); }, [content]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setValue(newValue);
        onChange(newValue);
    };
    return (
        <div className="flex flex-col gap-2">
            <div className="flex justify-end gap-2">
                 <button onClick={() => { setValue(''); onChange(''); }} className="text-xs flex items-center gap-1 text-slate-400 hover:text-red-500 transition-colors"><Eraser size={12} /> Effacer</button>
            </div>
            <textarea value={value} onChange={handleChange} className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-mono bg-slate-50 min-h-[200px] focus:ring-2 focus:ring-indigo-500 outline-none" spellCheck={false} placeholder="Code..." />
        </div>
    );
};

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ elements, currentPage, onUpdate, onDelete, onUpdatePage }) => {
  const [isImproving, setIsImproving] = React.useState(false);
  
  // AI Texture State
  const [texturePrompt, setTexturePrompt] = useState('');
  const [isGeneratingTexture, setIsGeneratingTexture] = useState(false);

  const handleGenerateTexture = async () => {
      if (!currentPage || !onUpdatePage || !texturePrompt.trim()) return;
      setIsGeneratingTexture(true);
      const textureUrl = await generatePageTexture(texturePrompt);
      if (textureUrl) {
          onUpdatePage(currentPage.id, { backgroundImage: textureUrl });
      } else {
          alert("Erreur de génération de texture.");
      }
      setIsGeneratingTexture(false);
      setTexturePrompt('');
  };

  // Helper for Color Picker with Transparent option
  const renderColorControl = (label: string, value: string | undefined, onChange: (val: string) => void) => {
      const isTransparent = value === 'transparent' || value === 'rgba(0,0,0,0)';
      return (
          <div>
              <label className="text-xs text-slate-500 mb-1 block">{label}</label>
              <div className="flex gap-2">
                   <div className="relative flex-1">
                       {isTransparent && (
                           <div className="absolute inset-0 flex items-center justify-center bg-white border border-slate-200 rounded pointer-events-none z-10">
                               <span className="text-[10px] text-slate-400 italic">Transparent</span>
                           </div>
                       )}
                       <input 
                          type="color" 
                          value={isTransparent ? '#ffffff' : (value || '#000000')} 
                          onChange={(e) => onChange(e.target.value)} 
                          className="h-8 w-full rounded cursor-pointer border border-slate-200" 
                       />
                   </div>
                   <button 
                      onClick={() => onChange('transparent')}
                      className={`px-2 rounded border text-xs flex items-center justify-center ${isTransparent ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                      title="Rendre transparent"
                   >
                      <Ban size={14} />
                   </button>
              </div>
          </div>
      );
  };

  // --- PAGE PROPERTIES (No Element Selected) ---
  if (elements.length === 0) {
    return (
      <div className="fixed right-4 top-20 w-80 bg-white p-5 rounded-xl shadow-xl border border-slate-200 no-print flex flex-col gap-5 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-semibold text-slate-700">Page</h3>
        </div>
        
        {currentPage && onUpdatePage && (
            <div className="flex flex-col gap-5">
                {/* 1. Background Color */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Palette size={12} /> Couleur de fond</label>
                    {renderColorControl(
                        "Couleur unie", 
                        currentPage.backgroundColor || '#ffffff', 
                        (val) => onUpdatePage(currentPage.id, { backgroundColor: val })
                    )}
                </div>

                {/* 2. Patterns */}
                <div>
                    <label className="text-xs font-bold text-slate-500 flex items-center gap-1 mb-2"><Grid size={12} /> Motif Papier</label>
                    <div className="grid grid-cols-3 gap-2">
                        <button 
                            onClick={() => onUpdatePage(currentPage.id, { background: 'none' })} 
                            className={`h-16 rounded border flex flex-col items-center justify-center gap-1 text-[10px] ${!currentPage.background || currentPage.background === 'none' ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 hover:bg-slate-50 text-slate-500'}`}
                        >
                            <div className="w-6 h-6 bg-white border border-slate-200 rounded-sm"></div>
                            Aucun
                        </button>
                        <button 
                            onClick={() => onUpdatePage(currentPage.id, { background: 'lines' })} 
                            className={`h-16 rounded border flex flex-col items-center justify-center gap-1 text-[10px] ${currentPage.background === 'lines' ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 hover:bg-slate-50 text-slate-500'}`}
                        >
                            <div className="w-6 h-6 bg-white border border-slate-200 rounded-sm flex flex-col justify-evenly px-0.5">
                                <div className="h-px bg-slate-300 w-full"></div>
                                <div className="h-px bg-slate-300 w-full"></div>
                                <div className="h-px bg-slate-300 w-full"></div>
                            </div>
                            Ligné
                        </button>
                        <button 
                            onClick={() => onUpdatePage(currentPage.id, { background: 'grid' })} 
                            className={`h-16 rounded border flex flex-col items-center justify-center gap-1 text-[10px] ${currentPage.background === 'grid' ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 hover:bg-slate-50 text-slate-500'}`}
                        >
                            <div className="w-6 h-6 bg-white border border-slate-200 rounded-sm" style={{backgroundImage: 'linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)', backgroundSize: '4px 4px'}}></div>
                            Quadrillé
                        </button>
                        <button 
                            onClick={() => onUpdatePage(currentPage.id, { background: 'seyes' })} 
                            className={`h-16 rounded border flex flex-col items-center justify-center gap-1 text-[10px] ${currentPage.background === 'seyes' ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 hover:bg-slate-50 text-slate-500'}`}
                        >
                            <div className="w-6 h-6 bg-white border border-slate-200 rounded-sm flex flex-col justify-evenly relative overflow-hidden">
                                <div className="absolute inset-0 opacity-50" style={{backgroundImage: 'linear-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '100% 3px'}}></div>
                                <div className="h-px bg-blue-400 w-full relative z-10"></div>
                                <div className="h-px bg-blue-400 w-full relative z-10"></div>
                            </div>
                            Seyès
                        </button>
                        <button 
                            onClick={() => onUpdatePage(currentPage.id, { background: 'dots' })} 
                            className={`h-16 rounded border flex flex-col items-center justify-center gap-1 text-[10px] ${currentPage.background === 'dots' ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 hover:bg-slate-50 text-slate-500'}`}
                        >
                            <div className="w-6 h-6 bg-white border border-slate-200 rounded-sm" style={{backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '4px 4px'}}></div>
                            Points
                        </button>
                    </div>
                </div>

                {/* 3. AI Texture / Image */}
                <div className="border-t border-slate-100 pt-3">
                     <label className="text-xs font-bold text-slate-500 flex items-center gap-1 mb-2"><ImagePlus size={12} /> Texture / Image de fond</label>
                     
                     {currentPage.backgroundImage ? (
                         <div className="relative w-full h-32 rounded-lg border border-slate-200 overflow-hidden group">
                             <img src={currentPage.backgroundImage} className="w-full h-full object-cover opacity-80" alt="Background" />
                             <button 
                                onClick={() => onUpdatePage(currentPage.id, { backgroundImage: undefined })}
                                className="absolute top-2 right-2 bg-white/90 p-1 rounded-full text-red-500 hover:bg-red-50 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                             >
                                 <X size={14} />
                             </button>
                         </div>
                     ) : (
                         <div className="flex flex-col gap-2">
                             <div className="flex gap-1">
                                <input 
                                    type="text" 
                                    value={texturePrompt} 
                                    onChange={(e) => setTexturePrompt(e.target.value)} 
                                    className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs" 
                                    placeholder="Ex: texture papier ancien, aquarelle..."
                                />
                                <button 
                                    onClick={handleGenerateTexture} 
                                    disabled={isGeneratingTexture || !texturePrompt.trim()}
                                    className="bg-indigo-600 text-white p-1.5 rounded disabled:opacity-50"
                                >
                                    {isGeneratingTexture ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                </button>
                             </div>
                             <p className="text-[10px] text-slate-400">Générez une texture unique avec l'IA.</p>
                         </div>
                     )}
                </div>
            </div>
        )}
        
        <div className="border-t border-slate-100 pt-4 text-xs text-slate-400 text-center italic mt-auto">
            Sélectionnez un élément pour modifier ses propriétés spécifiques.
        </div>
      </div>
    );
  }

  // --- ELEMENT PROPERTIES ---
  const isMulti = elements.length > 1;
  const firstEl = elements[0];
  
  // Helper to apply to all selected
  const handleStyleChange = (key: string, value: any) => {
    elements.forEach(el => {
        onUpdate(el.id, { style: { ...el.style, [key]: value } });
    });
  };

  const handleContentChange = (val: string) => {
      // Content change only allowed if single selection
      if (!isMulti) onUpdate(firstEl.id, { content: val });
  };

  const handleAIImprove = async () => {
    if (isMulti || firstEl.type !== ElementType.TEXT) return;
    setIsImproving(true);
    const improved = await analyzeAndImproveText(firstEl.content);
    onUpdate(firstEl.id, { content: improved });
    setIsImproving(false);
  };

  // Helper to extract/update .card background in HTML content
  const getCardColor = (content: string) => {
      if (!content) return '#ffffff';
      const match = content.match(/\.card\s*\{[^}]*background:\s*([^;!}]+)/);
      if (match) {
          const c = match[1].trim();
          if (c === 'white') return '#ffffff';
          if (c.startsWith('#')) return c;
      }
      return '#ffffff';
  };

  // Handle Layers
  const handleLayer = (action: 'front' | 'back' | 'up' | 'down') => {
      elements.forEach(el => {
          let newZ = el.style.zIndex;
          if (action === 'front') newZ = 100;
          if (action === 'back') newZ = 1;
          if (action === 'up') newZ += 1;
          if (action === 'down') newZ = Math.max(0, newZ - 1);
          onUpdate(el.id, { style: { ...el.style, zIndex: newZ } });
      });
  };

  const isHtmlType = [
      ElementType.HTML, ElementType.QCM, ElementType.FILL_IN_THE_BLANKS, 
      ElementType.MATCHING, ElementType.TIMELINE, ElementType.FLASHCARDS, 
      ElementType.TRUE_FALSE, ElementType.MIND_MAP
  ].includes(firstEl.type);

  return (
    <div className="fixed right-4 top-20 w-80 bg-white p-5 rounded-xl shadow-xl border border-slate-200 no-print flex flex-col gap-5 max-h-[80vh] overflow-y-auto z-50 scrollbar-thin" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
        <h3 className="font-semibold text-slate-700">{isMulti ? `${elements.length} éléments` : 'Propriétés'}</h3>
        <button onClick={() => elements.forEach(el => onDelete(el.id))} className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors" title="Supprimer">
          <Trash2 size={18} />
        </button>
      </div>

      {/* Dimensions - Show/Edit only if single */}
      {!isMulti && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
                <label className="text-xs text-slate-500">Largeur</label>
                <input type="number" value={firstEl.width} onChange={(e) => onUpdate(firstEl.id, { width: parseInt(e.target.value) })} disabled={firstEl.type === ElementType.SEQUENCE_TITLE} className="w-full border border-slate-200 rounded px-2 py-1" />
            </div>
            <div>
                <label className="text-xs text-slate-500">Hauteur</label>
                <input type="number" value={firstEl.height} onChange={(e) => onUpdate(firstEl.id, { height: parseInt(e.target.value) })} className="w-full border border-slate-200 rounded px-2 py-1" />
            </div>
          </div>
      )}

      {/* Z-Index */}
      <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
        <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Layers size={12} /> Calques</label>
        <div className="flex gap-1">
            <button onClick={() => handleLayer('back')} className="flex-1 bg-slate-50 hover:bg-slate-100 p-1.5 rounded text-xs text-slate-600" title="Arrière plan">Arr.</button>
            <button onClick={() => handleLayer('down')} className="flex-1 bg-slate-50 hover:bg-slate-100 p-1.5 rounded text-xs text-slate-600"><ArrowDown size={14}/></button>
            <button onClick={() => handleLayer('up')} className="flex-1 bg-slate-50 hover:bg-slate-100 p-1.5 rounded text-xs text-slate-600"><ArrowUp size={14}/></button>
            <button onClick={() => handleLayer('front')} className="flex-1 bg-slate-50 hover:bg-slate-100 p-1.5 rounded text-xs text-slate-600" title="Premier plan">Av.</button>
        </div>
      </div>

      {/* Content Editors (Single Selection Only) */}
      {!isMulti && (
          <>
            {(firstEl.type === ElementType.TEXT || firstEl.type === ElementType.SEQUENCE_TITLE || firstEl.type === ElementType.PART_TITLE || firstEl.type === ElementType.H3_TITLE || firstEl.type === ElementType.H4_TITLE) && (
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-500">Texte</label>
                        {firstEl.type === ElementType.TEXT && <button onClick={handleAIImprove} disabled={isImproving} className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100"><Wand2 size={12} /> {isImproving ? '...' : 'Améliorer'}</button>}
                    </div>
                    <textarea value={firstEl.content} onChange={(e) => handleContentChange(e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-sm min-h-[80px]" />
                </div>
            )}
            
            {firstEl.type === ElementType.AUDIO && (
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
                    <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Link2 size={12} /> Source Audio (URL)</label>
                    <input type="text" value={firstEl.content} onChange={(e) => handleContentChange(e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-sm" placeholder="https://..." />
                    <p className="text-[10px] text-slate-400">URL valide ou Data URI (généré par IA).</p>
                </div>
            )}

            {firstEl.type === ElementType.QR_CODE && (
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
                    <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Link2 size={12} /> Lien URL</label>
                    <input type="text" value={firstEl.content} onChange={(e) => handleContentChange(e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-sm" placeholder="https://..." />
                    <p className="text-[10px] text-slate-400">Entrez l'URL vers laquelle le QR Code doit pointer.</p>
                </div>
            )}
            {isHtmlType && (
                 <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
                    <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Code size={12} /> {firstEl.type === ElementType.QCM ? 'Données JSON' : 'Code HTML/SVG'}</label>
                    <CodeEditor content={firstEl.content} onChange={handleContentChange} />
                 </div>
            )}
            
            {/* .card CSS Color Picker */}
            {isHtmlType && firstEl.content.includes('.card') && (
                 <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 bg-indigo-50/50 p-2 rounded">
                    <label className="text-xs font-bold text-indigo-600 flex items-center gap-1"><Palette size={12} /> Style Carte (Interne)</label>
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">Couleur de fond (.card)</label>
                        <div className="flex gap-2">
                             <input 
                                type="color" 
                                value={getCardColor(firstEl.content)} 
                                onChange={(e) => {
                                    const newColor = e.target.value;
                                    // Regex handles: .card { ... background: <value> ... }
                                    const regex = /(\.card\s*\{[^}]*background:\s*)([^;!}]+)/;
                                    if (regex.test(firstEl.content)) {
                                        const newContent = firstEl.content.replace(regex, `$1${newColor}`);
                                        onUpdate(firstEl.id, { content: newContent });
                                    }
                                }}
                                className="h-8 w-full rounded cursor-pointer border border-slate-200" 
                             />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Modifie directement le CSS "background" de la classe .card dans le code HTML.</p>
                    </div>
                 </div>
            )}
          </>
      )}

      {/* Styles Common to Multi-Select */}
      <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
         <label className="text-xs font-bold text-slate-500">Apparence</label>
         
         {/* Background Color */}
         {renderColorControl(
             "Couleur de fond",
             firstEl.style.backgroundColor || '#ffffff',
             (val) => handleStyleChange('backgroundColor', val)
         )}

         {/* Text Color & Font */}
         <div className="flex gap-2 items-end">
            <div className="flex-1">
                {renderColorControl(
                    "Couleur Texte",
                    firstEl.style.color || '#000000',
                    (val) => handleStyleChange('color', val)
                )}
            </div>
            <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">Taille Police</label>
                <select value={firstEl.style.fontSize || 16} onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value))} className="h-8 w-full border border-slate-200 rounded text-sm">
                    {[10, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72].map(s => <option key={s} value={s}>{s}px</option>)}
                </select>
            </div>
         </div>

         <div className="flex gap-2">
             <button onClick={() => handleStyleChange('fontWeight', firstEl.style.fontWeight === 'bold' ? 'normal' : 'bold')} className={`p-2 rounded flex-1 flex justify-center items-center gap-1 text-sm ${firstEl.style.fontWeight === 'bold' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-white border border-slate-200 text-slate-600'}`}><Bold size={16} /> Gras</button>
             <button onClick={() => handleStyleChange('fontFamily', firstEl.style.fontFamily === 'Merriweather' ? 'Inter' : 'Merriweather')} className={`p-2 rounded flex-1 flex justify-center items-center gap-1 text-sm ${firstEl.style.fontFamily === 'Merriweather' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-white border border-slate-200 text-slate-600'}`}><TypeIcon size={16} /> Serif</button>
         </div>

         {/* Alignment Buttons */}
         <div className="flex gap-1 bg-slate-50 p-1 rounded-lg">
              {['left', 'center', 'right', 'justify'].map((align) => (
                  <button key={align} onClick={() => handleStyleChange('textAlign', align)} className={`p-1 rounded flex-1 flex justify-center ${firstEl.style.textAlign === align ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>
                      {align === 'left' && <AlignLeft size={16} />}
                      {align === 'center' && <AlignCenter size={16} />}
                      {align === 'right' && <AlignRight size={16} />}
                      {align === 'justify' && <AlignJustify size={16} />}
                  </button>
              ))}
         </div>

         {/* Borders & Radius */}
         <div>
            <label className="text-xs text-slate-500 mb-1 block">Arrondi ({firstEl.style.borderRadius || 0}px)</label>
            <input type="range" min="0" max="100" value={firstEl.style.borderRadius || 0} onChange={(e) => handleStyleChange('borderRadius', parseInt(e.target.value))} className="w-full accent-indigo-600" />
         </div>
         
         <div className="flex gap-2 items-center">
             <div className="flex-1">
                 <label className="text-xs text-slate-500 mb-1 block">Bordure</label>
                 <input type="number" min="0" max="20" value={firstEl.style.borderWidth || 0} onChange={(e) => handleStyleChange('borderWidth', parseInt(e.target.value))} className="w-full border border-slate-200 rounded px-2 py-1" />
             </div>
             
             <div className="mt-4">
                 {renderColorControl(
                     "", 
                     firstEl.style.borderColor || '#000000',
                     (val) => handleStyleChange('borderColor', val)
                 )}
             </div>
         </div>

         {/* Shadows */}
         <div className="border-t border-slate-100 pt-2 mt-2">
             <label className="text-xs font-bold text-slate-500 flex items-center gap-1 mb-2"><Square size={12} /> Ombre portée</label>
             <div className="grid grid-cols-3 gap-1">
                 <button onClick={() => handleStyleChange('boxShadow', 'none')} className="text-xs border p-1 rounded hover:bg-slate-50">Aucune</button>
                 <button onClick={() => handleStyleChange('boxShadow', '0 1px 2px 0 rgb(0 0 0 / 0.05)')} className="text-xs border p-1 rounded shadow-sm hover:bg-slate-50">Léger</button>
                 <button onClick={() => handleStyleChange('boxShadow', '0 4px 6px -1px rgb(0 0 0 / 0.1)')} className="text-xs border p-1 rounded shadow-md hover:bg-slate-50">Moyen</button>
                 <button onClick={() => handleStyleChange('boxShadow', '0 10px 15px -3px rgb(0 0 0 / 0.1)')} className="text-xs border p-1 rounded shadow-lg hover:bg-slate-50">Fort</button>
                 <button onClick={() => handleStyleChange('boxShadow', '0 20px 25px -5px rgb(0 0 0 / 0.1)')} className="text-xs border p-1 rounded shadow-xl hover:bg-slate-50">XL</button>
                 <button onClick={() => handleStyleChange('boxShadow', '0 25px 50px -12px rgb(0 0 0 / 0.25)')} className="text-xs border p-1 rounded shadow-2xl hover:bg-slate-50">2XL</button>
             </div>
         </div>
      </div>
    </div>
  );
};
