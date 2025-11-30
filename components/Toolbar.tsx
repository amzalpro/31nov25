
import React, { useRef } from 'react';
import { 
  Type, Image as ImageIcon, Square, Sparkles, Printer, BoxSelect, Save, FolderOpen, Grid, 
  Heading1, Heading2, Heading3, Heading4, BookTemplate, FileJson, Undo2, Redo2, Trash2, Copy, AlignLeft, 
  AlignCenter, AlignRight, AlignVerticalJustifyCenter, ArrowUp, ArrowDown, QrCode, Volume2, Eye, Settings,
  Zap
} from 'lucide-react';
import { ElementType } from '../types';

interface ToolbarProps {
  onAddElement: (type: ElementType) => void;
  onOpenAI: () => void;
  onPrint: () => void;
  onImageUpload: (file: File) => void;
  onSaveProject: () => void;
  onLoadProject: (file: File) => void;
  onExportHTML: () => void;
  onPreview: () => void;
  onViewSource: () => void;
  onOpenSettings: () => void;
  onLoadDemo: () => void; // New prop
  showGrid: boolean;
  onToggleGrid: () => void;
  
  // Edit Actions
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onCopy: () => void;
  
  // Selection Info
  selectionCount: number;
  onAlign: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v') => void;
}

const ToolGroup: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col gap-1 border-b border-slate-100 pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
    {title && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">{title}</span>}
    <div className="grid grid-cols-2 gap-1 px-1">
      {children}
    </div>
  </div>
);

const ToolButton: React.FC<{ 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string; 
  active?: boolean; 
  disabled?: boolean;
  fullWidth?: boolean;
  variant?: 'default' | 'primary' | 'danger' | 'success';
}> = ({ onClick, icon, label, active, disabled, fullWidth, variant = 'default' }) => {
  const baseClass = "p-2 rounded-lg transition-all group relative flex items-center justify-center";
  const widthClass = fullWidth ? "col-span-2 w-full" : "";
  
  let colorClass = "text-slate-600 hover:bg-slate-100";
  if (active) colorClass = "bg-indigo-50 text-indigo-600";
  if (variant === 'primary') colorClass = "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm";
  if (variant === 'success') colorClass = "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm";
  if (variant === 'danger') colorClass = "text-red-500 hover:bg-red-50";
  
  if (disabled) colorClass = "text-slate-300 cursor-not-allowed";

  return (
    <button 
      onClick={disabled ? undefined : onClick}
      className={`${baseClass} ${widthClass} ${colorClass}`}
      disabled={disabled}
    >
      {icon}
      <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50 shadow-lg">
        {label}
      </span>
    </button>
  );
};

export const Toolbar: React.FC<ToolbarProps> = ({ 
  onAddElement, onOpenAI, onPrint, onImageUpload, onSaveProject, onLoadProject, 
  onExportHTML, onPreview, onViewSource, onOpenSettings, onLoadDemo, showGrid, onToggleGrid,
  canUndo, canRedo, onUndo, onRedo, onDelete, onCopy,
  selectionCount, onAlign
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onImageUpload(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleProjectLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onLoadProject(e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed left-44 top-4 bottom-4 w-16 hover:w-auto hover:min-w-[60px] transition-all bg-white rounded-r-2xl shadow-xl border border-l-0 border-slate-200 flex flex-col py-3 z-50 no-print overflow-y-auto overflow-x-visible scrollbar-hide">
      
      {/* 1. History & Edit */}
      <ToolGroup>
        <ToolButton onClick={onUndo} icon={<Undo2 size={20} />} label="Annuler (Ctrl+Z)" disabled={!canUndo} />
        <ToolButton onClick={onRedo} icon={<Redo2 size={20} />} label="Rétablir (Ctrl+Y)" disabled={!canRedo} />
        <ToolButton onClick={onCopy} icon={<Copy size={20} />} label="Copier (Ctrl+C)" disabled={selectionCount === 0} />
        <ToolButton onClick={onDelete} icon={<Trash2 size={20} />} label="Supprimer (Suppr)" disabled={selectionCount === 0} variant="danger" />
      </ToolGroup>

      {/* 2. AI Assistant */}
      <ToolGroup title="IA">
        <ToolButton 
          onClick={onOpenAI} 
          icon={<Sparkles size={20} />} 
          label="Assistant IA (Générer contenu)" 
          fullWidth 
          variant="primary" 
        />
        <ToolButton 
          onClick={() => onAddElement(ElementType.SECTION)} 
          icon={<BoxSelect size={20} />} 
          label="Ajouter Zone IA" 
          fullWidth 
        />
      </ToolGroup>

      {/* 3. Insert Elements */}
      <ToolGroup title="Insertion">
        <ToolButton onClick={() => onAddElement(ElementType.TEXT)} icon={<Type size={20} />} label="Texte" />
        <ToolButton onClick={() => fileInputRef.current?.click()} icon={<ImageIcon size={20} />} label="Image" />
        <ToolButton onClick={() => onAddElement(ElementType.SHAPE)} icon={<Square size={20} />} label="Forme" />
        <ToolButton onClick={() => onAddElement(ElementType.QR_CODE)} icon={<QrCode size={20} />} label="QR Code" />
        <ToolButton onClick={() => onOpenAI()} icon={<Volume2 size={20} />} label="Audio / Voix" />
      </ToolGroup>
      
      {/* 4. Structure */}
      <ToolGroup title="Structure">
        <ToolButton onClick={() => onAddElement(ElementType.SEQUENCE_TITLE)} icon={<Heading1 size={20} />} label="Titre Séquence" />
        <ToolButton onClick={() => onAddElement(ElementType.PART_TITLE)} icon={<Heading2 size={20} />} label="Titre Partie" />
        <ToolButton onClick={() => onAddElement(ElementType.H3_TITLE)} icon={<Heading3 size={20} />} label="Sous-titre H3" />
        <ToolButton onClick={() => onAddElement(ElementType.H4_TITLE)} icon={<Heading4 size={20} />} label="Sous-titre H4" />
        <ToolButton onClick={() => onAddElement(ElementType.TOC)} icon={<AlignLeft size={20} />} label="Insérer Sommaire" />
      </ToolGroup>

      {/* 5. Alignment (Conditional) */}
      {selectionCount > 1 && (
        <ToolGroup title="Alignement">
          <ToolButton onClick={() => onAlign('left')} icon={<AlignLeft size={20} />} label="Aligner Gauche" />
          <ToolButton onClick={() => onAlign('center')} icon={<AlignCenter size={20} />} label="Aligner Centre H" />
          <ToolButton onClick={() => onAlign('right')} icon={<AlignRight size={20} />} label="Aligner Droite" />
          
          <ToolButton onClick={() => onAlign('top')} icon={<ArrowUp size={20} />} label="Aligner Haut" />
          <ToolButton onClick={() => onAlign('middle')} icon={<AlignVerticalJustifyCenter size={20} />} label="Aligner Milieu V" />
          <ToolButton onClick={() => onAlign('bottom')} icon={<ArrowDown size={20} />} label="Aligner Bas" />
        </ToolGroup>
      )}

      {/* 6. View & File */}
      <div className="mt-auto">
        <ToolGroup title="Projet">
            <ToolButton onClick={onLoadDemo} icon={<Zap size={20} />} label="Charger Démo" variant="success" fullWidth />
            
            <ToolButton onClick={onToggleGrid} icon={<Grid size={20} />} label={showGrid ? "Cacher Grille" : "Afficher Grille"} active={showGrid} />
            <ToolButton onClick={onPreview} icon={<Eye size={20} />} label="Aperçu Liseuse" />
            <ToolButton onClick={onViewSource} icon={<FileJson size={20} />} label="Code Source" />
            <ToolButton onClick={onSaveProject} icon={<Save size={20} />} label="Sauvegarder" />
            <ToolButton onClick={() => projectInputRef.current?.click()} icon={<FolderOpen size={20} />} label="Ouvrir" />
            <ToolButton onClick={onPrint} icon={<Printer size={20} />} label="Exporter PDF / Imprimer" />
            <ToolButton onClick={onExportHTML} icon={<BookTemplate size={20} />} label="Export Web" />
            <ToolButton onClick={onOpenSettings} icon={<Settings size={20} />} label="Paramètres par défaut" />
        </ToolGroup>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
      <input type="file" ref={projectInputRef} onChange={handleProjectLoad} accept=".json" className="hidden" />
    </div>
  );
};
