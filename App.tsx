import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Toolbar } from './components/Toolbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { AIModal } from './components/AIModal';
import { PageNavigator } from './components/PageNavigator';
import { SourceViewModal } from './components/SourceViewModal';
import { PreviewModal } from './components/PreviewModal';
import { SettingsModal } from './components/SettingsModal'; 
import { PageElement, ElementType, Page, Project, PageType, AppSettings, ElementStyle } from './types';
import { ElementRenderer } from './components/ElementRenderer';
import { v4 as uuidv4 } from 'uuid';
import { generateFlipbookHtml } from './services/exportService';

const A4_WIDTH_PX = 794; 
const A4_HEIGHT_PX = 1123;
const GRID_SIZE = 20;

// Default Settings Constant
const DEFAULT_SETTINGS: AppSettings = {
    defaultPage: {
        backgroundColor: '#ffffff',
        background: 'none'
    },
    elementDefaults: {
        [ElementType.TEXT]: { fontSize: 16, color: '#000000', fontFamily: 'Inter', backgroundColor: 'transparent' },
        [ElementType.SHAPE]: { backgroundColor: '#cbd5e1', borderWidth: 0, borderRadius: 0 },
        [ElementType.SECTION]: { borderRadius: 12, borderWidth: 2, borderColor: '#cbd5e1', backgroundColor: 'transparent' },
        [ElementType.AUDIO]: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' },
        [ElementType.SEQUENCE_TITLE]: { color: '#ffffff', backgroundColor: '#4f46e5', fontFamily: 'Inter' },
        [ElementType.PART_TITLE]: { color: '#1e293b', backgroundColor: '#f8fafc', borderColor: '#4f46e5', fontFamily: 'Inter' },
        [ElementType.H3_TITLE]: { color: '#334155', fontFamily: 'Inter', fontSize: 18, fontWeight: 'bold' },
        [ElementType.H4_TITLE]: { color: '#475569', fontFamily: 'Inter', fontSize: 16, fontWeight: 'bold' },
        [ElementType.TOC]: { backgroundColor: '#ffffff' }
    }
};

const Toast: React.FC<{ message: string, type?: 'success' | 'error' | 'info', onClose: () => void }> = ({ message, type = 'info', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bg = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-slate-800';

    return (
        <div className={`fixed bottom-4 right-4 ${bg} text-white px-4 py-2 rounded-lg shadow-lg z-[100] text-sm animate-in slide-in-from-bottom-5 fade-in duration-300 flex items-center gap-2`}>
            {message}
        </div>
    );
};

const App: React.FC = () => {
  // --- Settings State ---
  const [settings, setSettings] = useState<AppSettings>(() => {
      const saved = localStorage.getItem('appSettings_v3');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  useEffect(() => {
      localStorage.setItem('appSettings_v3', JSON.stringify(settings));
  }, [settings]);

  // --- Core State ---
  const [initialPages] = useState(() => {
      const cover: Page = { id: uuidv4(), type: 'cover', elements: [] };
      const white: Page = { id: uuidv4(), type: 'white', elements: [] };
      const summary: Page = { 
          id: uuidv4(), 
          type: 'summary', 
          elements: [{
              id: uuidv4(),
              type: ElementType.TOC,
              x: 40, y: 40,
              width: A4_WIDTH_PX - 80,
              height: 800,
              content: '',
              style: { zIndex: 1, backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent', boxShadow: 'none' }
          }] 
      };
      const standard: Page = { 
          id: uuidv4(), 
          type: 'standard', 
          elements: [], 
          backgroundColor: settings.defaultPage.backgroundColor,
          background: settings.defaultPage.background 
      };
      const back: Page = { id: uuidv4(), type: 'back_cover', elements: [] };
      return [cover, white, summary, standard, back];
  });

  const [pages, setPages] = useState<Page[]>(initialPages);
  const [currentPageId, setCurrentPageId] = useState<string>(initialPages[0].id);
  const [showGrid, setShowGrid] = useState(false);

  // --- History State ---
  const [history, setHistory] = useState<Page[][]>([initialPages]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // --- Selection State ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<PageElement[] | null>(null);
  const [interactingId, setInteractingId] = useState<string | null>(null);

  // --- UI State ---
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);
  
  const [resizeState, setResizeState] = useState<{
      isResizing: boolean;
      startX: number;
      startY: number;
      initialWidth: number;
      initialHeight: number;
      elementId: string | null;
  }>({
      isResizing: false,
      startX: 0,
      startY: 0,
      initialWidth: 0,
      initialHeight: 0,
      elementId: null
  });

  const canvasRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => setToast({ msg, type });
  
  const getCurrentPage = () => pages.find(p => p.id === currentPageId) || pages[0];
  const currentPage = getCurrentPage();
  const currentElements = currentPage?.elements || [];

  const snapToGrid = (value: number) => showGrid ? Math.round(value / GRID_SIZE) * GRID_SIZE : value;

  // --- Layout Engine ---
  
  const resolveCollisions = (elements: PageElement[]): PageElement[] => {
      const sorted = [...elements].sort((a, b) => a.y - b.y);
      const GAP = 20;
      let changed = false;
      const result = [...sorted];

      for (let i = 0; i < result.length; i++) {
          const current = result[i];
          for (let j = 0; j < i; j++) {
              const prev = result[j];
              const horizontalOverlap = 
                  (current.x < prev.x + prev.width) && 
                  (current.x + current.width > prev.x);

              if (horizontalOverlap) {
                  const requiredTop = prev.y + prev.height + GAP;
                  if (current.y < requiredTop) {
                      current.y = requiredTop;
                      changed = true;
                  }
              }
          }
      }
      return changed ? result : elements;
  };

  // --- History Management ---
  const saveToHistory = useCallback((newPages: Page[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newPages);
      if (newHistory.length > 50) newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setPages(newPages);
  }, [history, historyIndex]);

  const handleUndo = () => {
      if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          setPages(history[historyIndex - 1]);
      }
  };

  const handleRedo = () => {
      if (historyIndex < history.length - 1) {
          setHistoryIndex(historyIndex + 1);
          setPages(history[historyIndex + 1]);
      }
  };

  const updatePages = (newPages: Page[]) => {
      saveToHistory(newPages);
  };

  const handleAddPage = () => {
    const newPage: Page = { 
        id: uuidv4(), 
        type: 'standard', 
        elements: [],
        backgroundColor: settings.defaultPage.backgroundColor,
        background: settings.defaultPage.background
    };
    
    const currentIndex = pages.findIndex(p => p.id === currentPageId);
    let insertIndex = currentIndex >= 0 ? currentIndex + 1 : pages.length;

    const backCoverIndex = pages.findIndex(p => p.type === 'back_cover');
    if (backCoverIndex !== -1) {
        if (currentIndex === backCoverIndex) insertIndex = backCoverIndex;
        else if (insertIndex > backCoverIndex) insertIndex = backCoverIndex;
    }

    const newPages = [...pages];
    newPages.splice(insertIndex, 0, newPage);
    updatePages(newPages);
    setCurrentPageId(newPage.id);
  };

  const handleDeletePage = (id: string) => {
    if (pages.length <= 1) {
        showToast("Impossible de supprimer la dernière page", "error");
        return;
    }
    const idx = pages.findIndex(p => p.id === id);
    const newPages = pages.filter(p => p.id !== id);
    updatePages(newPages);
    if (currentPageId === id) {
      const newIdx = Math.max(0, idx - 1);
      setCurrentPageId(newPages[newIdx].id);
    }
  };

  const handleDuplicatePage = (id: string) => {
    const page = pages.find(p => p.id === id);
    if (!page) return;
    const newElements = (page.elements || []).map(el => ({...el, id: uuidv4()}));
    const newPage: Page = {
        id: uuidv4(),
        type: page.type,
        elements: newElements,
        background: page.background,
        backgroundColor: page.backgroundColor,
        backgroundImage: page.backgroundImage
    };
    const idx = pages.findIndex(p => p.id === id);
    const newPages = [...pages];
    newPages.splice(idx + 1, 0, newPage);
    updatePages(newPages);
    setCurrentPageId(newPage.id);
  };

  const handleToggleStructure = (type: PageType) => {
    const exists = pages.some(p => p.type === type);
    let newPages = [...pages];
    if (exists) {
        const deletedPage = pages.find(p => p.type === type);
        newPages = newPages.filter(p => p.type !== type);
        if (deletedPage && currentPageId === deletedPage.id) {
             setCurrentPageId(newPages[0]?.id || '');
        }
    } else {
        let initialElements: PageElement[] = [];
        if (type === 'summary') {
            initialElements.push({
                id: uuidv4(),
                type: ElementType.TOC,
                x: 40, y: 40,
                width: A4_WIDTH_PX - 80,
                height: 800,
                content: '',
                style: { zIndex: 1, backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent', boxShadow: 'none' }
            });
        }
        const newPage: Page = { 
            id: uuidv4(), 
            type, 
            elements: initialElements,
        };
        if (type === 'cover') newPages.unshift(newPage);
        else if (type === 'white') {
            const coverIdx = newPages.findIndex(p => p.type === 'cover');
            newPages.splice(coverIdx + 1, 0, newPage);
        }
        else if (type === 'summary') {
             let insertIdx = -1;
             const whiteIdx = newPages.findIndex(p => p.type === 'white');
             const coverIdx = newPages.findIndex(p => p.type === 'cover');
             if (whiteIdx !== -1) insertIdx = whiteIdx;
             else if (coverIdx !== -1) insertIdx = coverIdx;
             newPages.splice(insertIdx + 1, 0, newPage);
        }
        else if (type === 'back_cover') {
            newPages.push(newPage);
        }
        setCurrentPageId(newPage.id);
    }
    updatePages(newPages);
  };

  const handleUpdatePage = (id: string, updates: Partial<Page>) => {
      const newPages = pages.map(p => p.id === id ? { ...p, ...updates } : p);
      updatePages(newPages);
  };

  const structureData = useMemo(() => {
    const numberingMap: Record<string, string> = {};
    const tocList: any[] = [];
    let sequenceCount = 0;
    let partCount = 0;
    let standardPageCount = 0;
    pages.forEach(page => {
        if (page.type === 'standard') {
            standardPageCount++;
            const sortedElements = [...(page.elements || [])].sort((a, b) => a.y - b.y);
            sortedElements.forEach(el => {
                if (el.type === ElementType.SEQUENCE_TITLE) {
                    sequenceCount++;
                    partCount = 0;
                    const label = `SÉQUENCE ${sequenceCount}`;
                    numberingMap[el.id] = label;
                    tocList.push({ pageNum: standardPageCount, title: el.content, label, type: ElementType.SEQUENCE_TITLE, id: el.id, targetPageId: page.id });
                } else if (el.type === ElementType.PART_TITLE) {
                    partCount++;
                    const label = `${sequenceCount}.${partCount}`;
                    numberingMap[el.id] = label;
                    tocList.push({ pageNum: standardPageCount, title: el.content, label, type: ElementType.PART_TITLE, id: el.id, targetPageId: page.id });
                }
            });
        }
    });
    return { numberingMap, tocList };
  }, [pages]);

  const addElement = (type: ElementType, content: string = '') => {
    const id = uuidv4();
    let width = 200, height = 200;
    
    const bottomY = currentElements.length > 0 
        ? Math.max(...currentElements.map(e => e.y + e.height)) 
        : 40;
    
    let x = 40; 
    let y = bottomY + 20;

    const defaultStyles = settings.elementDefaults[type] || {};
    
    let styleConfig: ElementStyle & { zIndex: number } = {
        fontSize: 16,
        color: '#000000',
        backgroundColor: 'transparent',
        textAlign: 'left',
        fontFamily: 'Inter',
        zIndex: currentElements.length + 1,
        borderWidth: 0,
        borderColor: '#cbd5e1',
        borderRadius: 0,
        boxShadow: 'none',
        ...defaultStyles
    };

    if (type === ElementType.TEXT) { width = 300; height = 100; }
    else if (type === ElementType.SECTION) { width = 400; height = 300; }
    else if (type === ElementType.QCM) { width = 400; height = 350; }
    else if (type === ElementType.VIDEO) { width = 400; height = 225; }
    else if (type === ElementType.QR_CODE) { width = 150; height = 150; content = "https://www.google.com"; }
    else if (type === ElementType.CONNECT_DOTS) { width = 400; height = 400; }
    else if (type === ElementType.AUDIO) { width = 300; height = 60; }
    else if (type === ElementType.SEQUENCE_TITLE) { width = A4_WIDTH_PX; height = 150; x = 0; y = Math.max(0, y - 20); content = "TITRE SÉQUENCE"; }
    else if (type === ElementType.PART_TITLE) { width = 500; height = 60; content = "TITRE PARTIE"; }
    else if (type === ElementType.H3_TITLE) { width = 400; height = 50; content = "Sous-titre H3"; }
    else if (type === ElementType.H4_TITLE) { width = 300; height = 40; content = "Sous-titre H4"; }
    else if (type === ElementType.TOC) { width = A4_WIDTH_PX - 80; height = 800; x = 40; y = 40; }

    const newElement: PageElement = {
      id, type, x, y, width, height,
      content: content || (type === ElementType.TEXT ? 'Texte...' : ''),
      style: styleConfig
    };

    const newPages = pages.map(p => p.id === currentPageId ? { ...p, elements: [...(p.elements || []), newElement] } : p);
    updatePages(newPages);
    setSelectedIds(new Set([id]));
  };

  const updateElement = (id: string, updates: Partial<PageElement>) => {
    const newPages = pages.map(p => p.id === currentPageId ? { ...p, elements: (p.elements || []).map(el => el.id === id ? { ...el, ...updates } : el) } : p);
    updatePages(newPages);
  };

  const deleteElement = (id: string) => {
    const newPages = pages.map(p => p.id === currentPageId ? { ...p, elements: (p.elements || []).filter(el => el.id !== id) } : p);
    updatePages(newPages);
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  // --- Demo Loader ---
  const handleLoadDemo = () => {
      const demoPages: Page[] = [];
      const coverId = uuidv4();
      const s1Id = uuidv4();
      const p1Id = uuidv4();
      const p2Id = uuidv4();
      const p3Id = uuidv4();
      const p4Id = uuidv4();
      const p5Id = uuidv4();
      const p6Id = uuidv4();

      // --- 1. COVER ---
      const coverHtml = `<style>:root{--primary:#4f46e5;--text:#1e293b}body{margin:0;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Inter',sans-serif;background:radial-gradient(circle at top right, #e0e7ff 0%, #fff 60%)}.container{text-align:center;padding:60px;border:1px solid rgba(255,255,255,0.5);width:85%;background:rgba(255,255,255,0.6);backdrop-filter:blur(10px);border-radius:24px;box-shadow:0 20px 40px -10px rgba(79,70,229,0.1)}h1{font-size:3.5rem;color:var(--primary);margin:0;text-transform:uppercase;letter-spacing:0.1em;line-height:1}h2{font-size:1.8rem;color:var(--text);margin:20px 0;font-weight:300}.tag{display:inline-block;padding:8px 16px;background:var(--primary);color:white;border-radius:50px;font-size:0.8rem;font-weight:600;margin-top:20px}.footer{margin-top:60px;color:#64748b;font-size:0.9rem}</style><div class="container"><h1>Manuel Démo</h1><h2>Sciences &amp; Technologie</h2><div class="tag">CYCLE 4</div><div class="footer">Édition Numérique Interactive • StarterApp 2024</div></div>`;
      demoPages.push({ id: coverId, type: 'cover', elements: [{ id: uuidv4(), type: ElementType.HTML, x: 0, y: 0, width: A4_WIDTH_PX, height: A4_HEIGHT_PX, content: coverHtml, style: { zIndex: 1 } }] });

      // --- 2. WHITE & SUMMARY ---
      demoPages.push({ id: uuidv4(), type: 'white', elements: [] });
      demoPages.push({ id: uuidv4(), type: 'summary', elements: [{ id: uuidv4(), type: ElementType.TOC, x: 40, y: 40, width: A4_WIDTH_PX - 80, height: 800, content: '', style: { zIndex: 1, backgroundColor: 'transparent' } }] });

      // --- 3. PAGE 1: TYPOGRAPHY & TEXTURE ---
      demoPages.push({
          id: p1Id, type: 'standard', background: 'lines',
          elements: [
              { id: s1Id, type: ElementType.SEQUENCE_TITLE, x: 0, y: 40, width: A4_WIDTH_PX, height: 160, content: "L'Énergie et ses Formes", style: { zIndex: 1, backgroundColor: '#0ea5e9', color: '#fff' } },
              { id: uuidv4(), type: ElementType.PART_TITLE, x: 40, y: 240, width: 500, height: 60, content: "Définitions Fondamentales", style: { zIndex: 2, borderColor: '#0ea5e9' } },
              { id: uuidv4(), type: ElementType.TEXT, x: 40, y: 320, width: 700, height: 120, content: "L'énergie est une grandeur physique qui caractérise l'état d'un système et qui est globalement conservée au cours des transformations. Elle s'exprime en Joules (J). Nous allons explorer ses différentes formes : cinétique, potentielle, thermique, chimique, etc.", style: { zIndex: 3, fontSize: 16, textAlign: 'justify' } },
              { id: uuidv4(), type: ElementType.HTML, x: 40, y: 460, width: 700, height: 140, content: `<style>.def-box{background:#f0f9ff;border-left:4px solid #0ea5e9;padding:15px;font-family:sans-serif;border-radius:0 8px 8px 0;box-shadow:0 2px 5px rgba(0,0,0,0.05)}.title{font-weight:bold;color:#0369a1;text-transform:uppercase;font-size:12px;margin-bottom:5px}strong{color:#0284c7}</style><div class="def-box"><div class="title">Définition à retenir</div><strong>L'Énergie Cinétique</strong> est l'énergie que possède un corps du fait de son mouvement. Elle dépend de la masse et de la vitesse de l'objet.<br>Formule : Ec = 1/2 * m * v²</div>`, style: { zIndex: 4 } },
              { id: uuidv4(), type: ElementType.H3_TITLE, x: 40, y: 640, width: 400, height: 40, content: "Écoutez la leçon", style: { zIndex: 5, color: '#0369a1' } },
              { id: uuidv4(), type: ElementType.AUDIO, x: 40, y: 700, width: 350, height: 70, content: "https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav", style: { zIndex: 6, borderRadius: 12 } }
          ]
      });

      // --- 4. PAGE 2: MULTIMEDIA ---
      demoPages.push({
          id: p2Id, type: 'standard', backgroundColor: '#fff',
          elements: [
              { id: uuidv4(), type: ElementType.PART_TITLE, x: 40, y: 40, width: 500, height: 60, content: "Illustrations & Schémas", style: { zIndex: 1, borderColor: '#8b5cf6' } },
              { id: uuidv4(), type: ElementType.H4_TITLE, x: 40, y: 120, width: 300, height: 40, content: "Le Cycle de l'Eau (SVG)", style: { zIndex: 2 } },
              { id: uuidv4(), type: ElementType.SVG, x: 40, y: 170, width: 340, height: 250, content: `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#bae6fd"/><stop offset="100%" stop-color="#fff"/></linearGradient></defs><rect width="200" height="150" fill="url(#sky)"/><path d="M0 120 Q50 110 100 120 T200 120 V150 H0 Z" fill="#3b82f6"/><circle cx="170" cy="30" r="15" fill="#fbbf24"/><path d="M20 120 L40 80 L60 120" fill="#65a30d"/><path d="M140 120 L160 70 L180 120" fill="#65a30d"/><text x="100" y="140" text-anchor="middle" font-size="8" fill="white">OCÉAN</text><path d="M50 30 Q70 10 90 30 T130 30" fill="white" opacity="0.8"/><text x="170" y="60" text-anchor="middle" font-size="6" fill="#f59e0b">SOLEIL</text></svg>`, style: { zIndex: 3 } },
              { id: uuidv4(), type: ElementType.H4_TITLE, x: 400, y: 120, width: 300, height: 40, content: "Vidéo Explicative (Veo)", style: { zIndex: 4 } },
              { id: uuidv4(), type: ElementType.SHAPE, x: 400, y: 170, width: 350, height: 200, content: "", style: { zIndex: 5, backgroundColor: '#000', borderRadius: 8 } },
              { id: uuidv4(), type: ElementType.TEXT, x: 410, y: 250, width: 330, height: 40, content: "Video Placeholder", style: { zIndex: 6, color: 'white', textAlign: 'center' } },
              { id: uuidv4(), type: ElementType.QR_CODE, x: 600, y: 400, width: 150, height: 150, content: "https://edu.google.com", style: { zIndex: 7 } },
              { id: uuidv4(), type: ElementType.TEXT, x: 600, y: 560, width: 150, height: 30, content: "Scannez pour +", style: { zIndex: 8, fontSize: 10, textAlign: 'center', color: '#64748b' } }
          ]
      });

      // --- 5. PAGE 3: KNOWLEDGE CHECK ---
      const qcmJson = JSON.stringify([
          {question: "Quelle est l'unité de l'énergie ?", options: ["Newton", "Joule", "Watt"], correctIndex: 1},
          {question: "L'énergie cinétique dépend de...", options: ["La hauteur", "La vitesse", "La couleur"], correctIndex: 1},
          {question: "L'énergie se conserve-t-elle ?", options: ["Oui", "Non", "Parfois"], correctIndex: 0}
      ]);
      const trueFalseHtml = `<style>.tf-item{display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #eee;font-family:sans-serif;font-size:14px}.tf-opts{display:flex;gap:10px}label{cursor:pointer;display:flex;align-items:center;gap:4px}.btn-check{margin-top:15px;width:100%;padding:8px;background:#4f46e5;color:white;border:none;border-radius:6px;cursor:pointer}</style><div id="tf-app"><div class="tf-item"><span>L'eau bout à 90°C au niveau de la mer.</span><div class="tf-opts"><label><input type="radio" name="q1" value="v"> V</label><label><input type="radio" name="q1" value="f"> F</label></div></div><div class="tf-item"><span>Le soleil est une étoile.</span><div class="tf-opts"><label><input type="radio" name="q2" value="v"> V</label><label><input type="radio" name="q2" value="f"> F</label></div></div><button class="btn-check" onclick="alert('Bravo !')">Vérifier</button></div>`;
      const fillBlanksHtml = `<style>input{border:none;border-bottom:2px solid #4f46e5;width:80px;text-align:center;background:#f5f3ff;font-weight:bold;color:#4f46e5;outline:none}body{font-family:sans-serif;line-height:2;font-size:15px;padding:10px}</style><div>La capitale de la France est <input type="text" placeholder="...">. Elle est traversée par la <input type="text" placeholder="...">. C'est une ville très <input type="text" placeholder="...">.</div>`;

      demoPages.push({
          id: p3Id, type: 'standard', backgroundColor: '#f8fafc',
          elements: [
              { id: uuidv4(), type: ElementType.PART_TITLE, x: 40, y: 40, width: 500, height: 60, content: "Exercices Interactifs", style: { zIndex: 1, borderColor: '#16a34a' } },
              { id: uuidv4(), type: ElementType.H4_TITLE, x: 40, y: 120, width: 300, height: 40, content: "QCM (JSON Native)", style: { zIndex: 2 } },
              { id: uuidv4(), type: ElementType.QCM, x: 40, y: 170, width: 340, height: 350, content: qcmJson, style: { zIndex: 3 } },
              { id: uuidv4(), type: ElementType.H4_TITLE, x: 400, y: 120, width: 300, height: 40, content: "Vrai / Faux", style: { zIndex: 4 } },
              { id: uuidv4(), type: ElementType.TRUE_FALSE, x: 400, y: 170, width: 350, height: 200, content: trueFalseHtml, style: { zIndex: 5, backgroundColor: 'white', borderRadius: 12 } },
              { id: uuidv4(), type: ElementType.H4_TITLE, x: 400, y: 400, width: 300, height: 40, content: "Texte à Trous", style: { zIndex: 6 } },
              { id: uuidv4(), type: ElementType.FILL_IN_THE_BLANKS, x: 400, y: 450, width: 350, height: 150, content: fillBlanksHtml, style: { zIndex: 7, backgroundColor: 'white', borderRadius: 12 } }
          ]
      });

      // --- 6. PAGE 4: DEEP DIVE (3D, MindMap, Timeline) ---
      const pyramidStl = `solid pyramid
facet normal 0 0 -1
outer loop
vertex 0 0 0
vertex 10 0 0
vertex 0 10 0
endloop
endfacet
facet normal 0 0 -1
outer loop
vertex 10 10 0
vertex 0 10 0
vertex 10 0 0
endloop
endfacet
facet normal 0.7 0.7 0.7
outer loop
vertex 0 0 0
vertex 0 10 0
vertex 5 5 10
endloop
endfacet
facet normal 0.7 0.7 0.7
outer loop
vertex 10 0 0
vertex 0 0 0
vertex 5 5 10
endloop
endfacet
facet normal 0.7 0.7 0.7
outer loop
vertex 10 10 0
vertex 10 0 0
vertex 5 5 10
endloop
endfacet
facet normal 0.7 0.7 0.7
outer loop
vertex 0 10 0
vertex 10 10 0
vertex 5 5 10
endloop
endfacet
endsolid pyramid`;
      
      const mindMapHtml = `<div style="display:flex;justify-content:center;align-items:center;height:100%;font-family:sans-serif"><div style="position:relative;width:300px;height:200px"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#4f46e5;color:white;padding:10px 20px;border-radius:20px;font-weight:bold;z-index:2">Énergie</div><div style="position:absolute;top:10%;left:10%;background:#e0e7ff;color:#3730a3;padding:5px 10px;border-radius:10px;font-size:12px">Cinétique</div><div style="position:absolute;bottom:10%;right:10%;background:#e0e7ff;color:#3730a3;padding:5px 10px;border-radius:10px;font-size:12px">Potentielle</div><svg style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:1"><line x1="150" y1="100" x2="50" y2="30" stroke="#cbd5e1" stroke-width="2"/><line x1="150" y1="100" x2="250" y2="170" stroke="#cbd5e1" stroke-width="2"/></svg></div></div>`;
      const timelineHtml = `<style>.tl{position:relative;padding-left:20px;font-family:sans-serif;font-size:12px}.tl-item{position:relative;margin-bottom:15px;padding-left:15px}.tl-item::before{content:'';position:absolute;left:-4px;top:4px;width:8px;height:8px;border-radius:50%;background:#4f46e5}.tl::before{content:'';position:absolute;left:0;top:5px;bottom:0;width:2px;background:#e2e8f0}.date{font-weight:bold;color:#4f46e5}</style><div class="tl"><div class="tl-item"><div class="date">1769</div><div>Machine à Vapeur (Watt)</div></div><div class="tl-item"><div class="date">1800</div><div>Pile Voltaïque</div></div><div class="tl-item"><div class="date">1879</div><div>Ampoule (Edison)</div></div><div class="tl-item"><div class="date">1954</div><div>Panneau Solaire</div></div></div>`;

      demoPages.push({
          id: p4Id, type: 'standard', backgroundColor: '#fff',
          elements: [
              { id: uuidv4(), type: ElementType.PART_TITLE, x: 40, y: 40, width: 500, height: 60, content: "Modélisation & Synthèse", style: { zIndex: 1, borderColor: '#ea580c' } },
              { id: uuidv4(), type: ElementType.H4_TITLE, x: 40, y: 120, width: 300, height: 40, content: "Modèle 3D (STL)", style: { zIndex: 2 } },
              { id: uuidv4(), type: ElementType.THREED_MODEL, x: 40, y: 170, width: 340, height: 300, content: pyramidStl, style: { zIndex: 3, backgroundColor: '#f1f5f9', borderRadius: 12 } },
              { id: uuidv4(), type: ElementType.H4_TITLE, x: 400, y: 120, width: 300, height: 40, content: "Carte Mentale", style: { zIndex: 4 } },
              { id: uuidv4(), type: ElementType.MIND_MAP, x: 400, y: 170, width: 350, height: 250, content: mindMapHtml, style: { zIndex: 5, backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12 } },
              { id: uuidv4(), type: ElementType.H4_TITLE, x: 400, y: 440, width: 300, height: 40, content: "Frise Chronologique", style: { zIndex: 6 } },
              { id: uuidv4(), type: ElementType.TIMELINE, x: 400, y: 490, width: 350, height: 200, content: timelineHtml, style: { zIndex: 7 } }
          ]
      });

      // --- 7. PAGE 5: GAMES & PRACTICE ---
      const dotsData = JSON.stringify([{x:50,y:20,label:1},{x:80,y:40,label:2},{x:70,y:80,label:3},{x:30,y:80,label:4},{x:20,y:40,label:5}]);
      const matchingHtml = `<style>.match-container{display:flex;justify-content:space-between;padding:10px;font-family:sans-serif;font-size:13px}.col{display:flex;flex-direction:column;gap:10px}.item{padding:8px 12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer}.item:hover{border-color:#4f46e5;background:#e0e7ff}</style><div class="match-container"><div class="col"><div class="item">Pomme</div><div class="item">Banane</div><div class="item">Cerise</div></div><div class="col"><div class="item">Jaune</div><div class="item">Rouge</div><div class="item">Vert</div></div></div>`;
      const flashHtml = `<style>.card{perspective:1000px;width:150px;height:100px;cursor:pointer}.inner{position:relative;width:100%;height:100%;transition:transform 0.6s;transform-style:preserve-3d}.card:hover .inner{transform:rotateY(180deg)}.front,.back{position:absolute;width:100%;height:100%;backface-visibility:hidden;display:flex;align-items:center;justify-content:center;border-radius:10px;font-family:sans-serif;font-weight:bold;box-shadow:0 4px 6px rgba(0,0,0,0.1)}.front{background:white;color:#333;border:2px solid #4f46e5}.back{background:#4f46e5;color:white;transform:rotateY(180deg)}</style><div style="display:flex;gap:20px;justify-content:center;padding:20px"><div class="card"><div class="inner"><div class="front">Soleil</div><div class="back">Star</div></div></div><div class="card"><div class="inner"><div class="front">Lune</div><div class="back">Moon</div></div></div></div>`;

      demoPages.push({
          id: p5Id, type: 'standard', backgroundColor: '#f0fdf4',
          elements: [
              { id: uuidv4(), type: ElementType.PART_TITLE, x: 40, y: 40, width: 500, height: 60, content: "Jeux & Révisions", style: { zIndex: 1, borderColor: '#db2777' } },
              { id: uuidv4(), type: ElementType.H4_TITLE, x: 40, y: 120, width: 300, height: 40, content: "Appariement", style: { zIndex: 2 } },
              { id: uuidv4(), type: ElementType.MATCHING, x: 40, y: 170, width: 340, height: 180, content: matchingHtml, style: { zIndex: 3, backgroundColor: 'white', borderRadius: 8 } },
              { id: uuidv4(), type: ElementType.H4_TITLE, x: 40, y: 380, width: 300, height: 40, content: "Points à Relier", style: { zIndex: 4 } },
              { id: uuidv4(), type: ElementType.CONNECT_DOTS, x: 40, y: 430, width: 340, height: 340, content: dotsData, style: { zIndex: 5, borderRadius: 12, backgroundColor: 'white' } },
              { id: uuidv4(), type: ElementType.H4_TITLE, x: 400, y: 120, width: 300, height: 40, content: "Flashcards", style: { zIndex: 6 } },
              { id: uuidv4(), type: ElementType.FLASHCARDS, x: 400, y: 170, width: 350, height: 200, content: flashHtml, style: { zIndex: 7 } }
          ]
      });

      // --- 8. PAGE 6: MINI APP ---
      const miniAppHtml = `<style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;font-family:sans-serif;background:#1e293b;color:white}button{padding:10px 20px;font-size:16px;background:#38bdf8;border:none;border-radius:8px;cursor:pointer;margin-top:10px}button:hover{background:#0ea5e9}.display{font-size:32px;font-weight:bold;font-family:monospace;padding:20px;background:#0f172a;border-radius:12px;min-width:100px;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,0.3)}</style><div><div class="display" id="cnt">0</div><div style="display:flex;gap:10px"><button onclick="up()">+1</button><button onclick="dn()" style="background:#f43f5e">-1</button></div></div><script>let c=0;const d=document.getElementById('cnt');function up(){c++;d.innerText=c}function dn(){c--;d.innerText=c}</script>`;

      demoPages.push({
          id: p6Id, type: 'standard', backgroundColor: '#fff',
          elements: [
               { id: uuidv4(), type: ElementType.PART_TITLE, x: 40, y: 40, width: 500, height: 60, content: "Laboratoire Interactif", style: { zIndex: 1, borderColor: '#6366f1' } },
               { id: uuidv4(), type: ElementType.TEXT, x: 40, y: 120, width: 700, height: 60, content: "Cette page intègre une 'Mini App' complète : un compteur interactif codé en HTML/JS et encapsulé. Cela permet de créer des simulateurs, calculatrices ou expériences virtuelles.", style: { zIndex: 2 } },
               { id: uuidv4(), type: ElementType.HTML, x: 200, y: 200, width: 400, height: 300, content: miniAppHtml, style: { zIndex: 3, borderRadius: 16, boxShadow: '0 10px 20px rgba(0,0,0,0.2)' } }
          ]
      });

      // --- 9. BACK COVER ---
      demoPages.push({ id: uuidv4(), type: 'back_cover', elements: [] });

      updatePages(demoPages);
      setCurrentPageId(coverId);
      showToast("Démonstration complète chargée !", "success");
  };

  // --- Handlers ---
  const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v') => {
      if (selectedIds.size < 2) return;
      const selectedEls = currentElements.filter(el => selectedIds.has(el.id));
      let newElements = [...currentElements];
      
      if (type === 'left') {
          const minX = Math.min(...selectedEls.map(el => el.x));
          selectedEls.forEach(el => { const idx = newElements.findIndex(e => e.id === el.id); newElements[idx] = {...el, x: minX}; });
      } else if (type === 'right') {
          const maxX = Math.max(...selectedEls.map(el => el.x + el.width));
          selectedEls.forEach(el => { const idx = newElements.findIndex(e => e.id === el.id); newElements[idx] = {...el, x: maxX - el.width}; });
      } else if (type === 'center') {
          const minX = Math.min(...selectedEls.map(el => el.x));
          const maxX = Math.max(...selectedEls.map(el => el.x + el.width));
          const center = (minX + maxX) / 2;
          selectedEls.forEach(el => { const idx = newElements.findIndex(e => e.id === el.id); newElements[idx] = {...el, x: center - el.width / 2}; });
      } else if (type === 'top') {
          const minY = Math.min(...selectedEls.map(el => el.y));
          selectedEls.forEach(el => { const idx = newElements.findIndex(e => e.id === el.id); newElements[idx] = {...el, y: minY}; });
      } else if (type === 'bottom') {
          const maxY = Math.max(...selectedEls.map(el => el.y + el.height));
          selectedEls.forEach(el => { const idx = newElements.findIndex(e => e.id === el.id); newElements[idx] = {...el, y: maxY - el.height}; });
      } else if (type === 'middle') {
           const minY = Math.min(...selectedEls.map(el => el.y));
           const maxY = Math.max(...selectedEls.map(el => el.y + el.height));
           const middle = (minY + maxY) / 2;
           selectedEls.forEach(el => { const idx = newElements.findIndex(e => e.id === el.id); newElements[idx] = {...el, y: middle - el.height / 2}; });
      } else if (type === 'distribute-v') {
          selectedEls.sort((a, b) => a.y - b.y);
          const start = selectedEls[0].y;
          const end = selectedEls[selectedEls.length - 1].y;
          const totalH = end - start;
          const gap = totalH / (selectedEls.length - 1);
          selectedEls.forEach((el, i) => { 
              const idx = newElements.findIndex(e => e.id === el.id); 
              newElements[idx] = {...el, y: start + (gap * i)}; 
          });
      }
      const newPages = pages.map(p => p.id === currentPageId ? { ...p, elements: newElements } : p);
      updatePages(newPages);
  };

  const [dragInfo, setDragInfo] = useState<{ startX: number, startY: number, initialPos: {id: string, x: number, y: number}[] } | null>(null);
  
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    let newSelection = new Set(selectedIds);
    if (e.shiftKey) {
        if (newSelection.has(id)) newSelection.delete(id);
        else newSelection.add(id);
    } else {
        if (!newSelection.has(id)) {
            newSelection.clear();
            newSelection.add(id);
        }
    }
    setSelectedIds(newSelection);
    setInteractingId(null);
    const selectedEls = currentElements.filter(el => newSelection.has(el.id));
    setDragInfo({
        startX: e.clientX,
        startY: e.clientY,
        initialPos: selectedEls.map(el => ({ id: el.id, x: el.x, y: el.y }))
    });
  };

  const handleCanvasMouseDown = () => {
      setSelectedIds(new Set());
      setInteractingId(null);
  };

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (dragInfo) {
              const dx = e.clientX - dragInfo.startX;
              const dy = e.clientY - dragInfo.startY;
              const newElements = [...currentElements];
              dragInfo.initialPos.forEach(item => {
                  const elIdx = newElements.findIndex(el => el.id === item.id);
                  if (elIdx !== -1) {
                      const el = newElements[elIdx];
                      let nx = snapToGrid(item.x + dx);
                      let ny = snapToGrid(item.y + dy);
                      if (el.type === ElementType.SEQUENCE_TITLE) { nx = 0; ny = 0; }
                      newElements[elIdx] = { ...el, x: nx, y: ny };
                  }
              });
              setPages(prev => prev.map(p => p.id === currentPageId ? { ...p, elements: newElements } : p));
          } else if (resizeState.isResizing && resizeState.elementId) {
              const dx = e.clientX - resizeState.startX;
              const dy = e.clientY - resizeState.startY;
              const currentEl = currentElements.find(el => el.id === resizeState.elementId);
              if (currentEl) {
                  let nw = snapToGrid(Math.max(50, resizeState.initialWidth + dx));
                  let nh = snapToGrid(Math.max(50, resizeState.initialHeight + dy));
                  if (currentEl.type === ElementType.SEQUENCE_TITLE) nw = A4_WIDTH_PX;
                  if (currentEl.type === ElementType.TOC) nw = Math.min(nw, A4_WIDTH_PX);
                  const newElements = currentElements.map(el => el.id === resizeState.elementId ? { ...el, width: nw, height: nh } : el);
                  setPages(prev => prev.map(p => p.id === currentPageId ? { ...p, elements: newElements } : p));
              }
          }
      };

      const handleMouseUp = () => {
          if (dragInfo || resizeState.isResizing) {
              const resolvedElements = resolveCollisions(currentElements);
              
              const newPages = pages.map(p => p.id === currentPageId ? { ...p, elements: resolvedElements } : p);
              updatePages(newPages);

              setDragInfo(null);
              setResizeState(prev => ({ ...prev, isResizing: false }));
          }
      };

      if (dragInfo || resizeState.isResizing) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      }
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [dragInfo, resizeState, currentElements, pages, currentPageId, saveToHistory]);

  const handleAIGenerated = (content: string, type: 'text' | 'image' | 'html' | 'svg' | 'qcm' | 'cover' | 'fill_in_the_blanks' | 'matching' | 'timeline' | 'flashcards' | 'true_false' | 'mind_map' | 'threed_model' | 'video' | 'connect_dots' | 'texture' | 'audio') => {
      if (type === 'cover') {
          const coverElement: PageElement = { id: uuidv4(), type: ElementType.HTML, x: 0, y: 0, width: A4_WIDTH_PX, height: A4_HEIGHT_PX, content: content, style: { zIndex: 1, backgroundColor: 'white', borderWidth: 0, borderColor: 'transparent', boxShadow: 'none' } };
          const newPages = [...pages];
          const idx = newPages.findIndex(p => p.type === 'cover');
          if (idx !== -1) newPages[idx].elements = [coverElement];
          else newPages.unshift({ id: uuidv4(), type: 'cover', elements: [coverElement] });
          updatePages(newPages);
          return;
      }
      if (type === 'texture') {
          handleUpdatePage(currentPageId, { backgroundImage: content });
          showToast('Texture de fond appliquée avec succès !', 'success');
          return;
      }
      let newType: ElementType;
      switch (type) {
          case 'image': newType = ElementType.IMAGE; break;
          case 'video': newType = ElementType.VIDEO; break;
          case 'svg': newType = ElementType.SVG; break;
          case 'mind_map': newType = ElementType.MIND_MAP; break;
          case 'qcm': newType = ElementType.QCM; break;
          case 'threed_model': newType = ElementType.THREED_MODEL; break;
          case 'connect_dots': newType = ElementType.CONNECT_DOTS; break;
          case 'audio': newType = ElementType.AUDIO; break;
          case 'html':
          case 'fill_in_the_blanks':
          case 'matching':
          case 'timeline':
          case 'flashcards':
          case 'true_false': newType = ElementType.HTML; break;
          default: newType = ElementType.TEXT;
      }
      if (targetSectionId) {
          const el = currentElements.find(e => e.id === targetSectionId);
          if (el) {
            updateElement(targetSectionId, { type: newType, content, style: { ...el.style, backgroundColor: 'transparent', borderWidth: 0 } });
          }
          setTargetSectionId(null);
      } else {
          addElement(newType, content);
      }
      showToast('Contenu généré avec succès !', 'success');
  };
  
  useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
          if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
          if (selectedIds.size === 0 || interactingId) return;
          if (e.key === 'Delete' || e.key === 'Backspace') {
              const newPages = pages.map(p => p.id === currentPageId ? { ...p, elements: (p.elements || []).filter(el => !selectedIds.has(el.id)) } : p);
              updatePages(newPages);
              setSelectedIds(new Set());
          }
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
          if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); handleRedo(); }
          if ((e.ctrlKey || e.metaKey) && e.key === 'c') { setClipboard(currentElements.filter(el => selectedIds.has(el.id))); }
          if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
               const newEls = clipboard.map(el => ({ ...el, id: uuidv4(), x: el.x + 20, y: el.y + 20 }));
               const newPages = pages.map(p => p.id === currentPageId ? { ...p, elements: [...(p.elements || []), ...newEls] } : p);
               updatePages(newPages);
               setSelectedIds(new Set(newEls.map(e => e.id)));
          }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, interactingId, clipboard, pages, currentPageId, history, historyIndex]);

  const handleSaveProject = () => {
    const project: Project = { id: uuidv4(), name: "Mon Projet Manuel Scolaire", version: "2.0", pages: pages, updatedAt: Date.now() };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `manuel-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleLoadProject = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (e.target?.result) {
          const project = JSON.parse(e.target.result as string) as Project;
          if (project.pages && Array.isArray(project.pages)) {
            const validatedPages = project.pages.map(p => ({
                ...p,
                elements: Array.isArray(p.elements) ? p.elements : []
            }));
            saveToHistory(validatedPages);
            setCurrentPageId(validatedPages[0]?.id || '');
            showToast("Projet chargé avec succès", "success");
          }
        }
      } catch (err) { showToast("Erreur de lecture du fichier", "error"); }
    };
    reader.readAsText(file);
  };

  const handleExportHTML = () => {
     const project = { id: uuidv4(), name: "Manuel Scolaire", version: "1.0", pages, updatedAt: Date.now() };
     const html = generateFlipbookHtml(project);
     const blob = new Blob([html], { type: 'text/html' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement('a'); link.href = url; link.download = `liseuse.html`;
     document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleExportPDF = () => { window.print(); };
  
  const getPageBackgroundStyle = (page: Page) => {
      if (!page) return {};
      const style: React.CSSProperties = { backgroundColor: page.backgroundColor || '#ffffff' };
      let imgParts: string[] = [];
      let sizeParts: string[] = [];

      if (page.background === 'lines') {
          imgParts.push('linear-gradient(#94a3b8 1px, transparent 1px)');
          sizeParts.push('100% 2rem');
      } else if (page.background === 'grid') {
          imgParts.push('linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)');
          sizeParts.push('20px 20px');
      } else if (page.background === 'dots') {
          imgParts.push('radial-gradient(#94a3b8 1px, transparent 1px)');
          sizeParts.push('20px 20px');
      } else if (page.background === 'seyes') {
          imgParts.push('linear-gradient(90deg, #ef4444 0.5px, transparent 0.5px), linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(#e2e8f0 1px, transparent 1px)');
          sizeParts.push('8rem 100%, 100% 2rem, 100% 0.5rem');
      }
      if (page.backgroundImage) {
          imgParts.push(`url(${page.backgroundImage})`);
          sizeParts.push('cover');
      }
      if (imgParts.length > 0) {
          style.backgroundImage = imgParts.join(', ');
          style.backgroundSize = sizeParts.join(', ');
      }
      return style;
  };

  const selectedElements = currentElements.filter(el => selectedIds.has(el.id));

  return (
    <div className="min-h-screen flex bg-slate-100" onClick={handleCanvasMouseDown}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <PageNavigator 
        pages={pages} currentPageId={currentPageId} onSelectPage={setCurrentPageId}
        onAddPage={handleAddPage} onDeletePage={handleDeletePage} onDuplicatePage={handleDuplicatePage}
        onToggleStructure={handleToggleStructure}
      />

      <div className="flex-1 flex flex-col ml-40 no-print">
        <header className="sticky top-0 left-0 w-full bg-white/80 backdrop-blur z-40 border-b border-slate-200 px-6 py-3 flex justify-between items-center">
           <h1 className="text-xl font-bold text-slate-800">Editeur Manuel Scolaire Pro</h1>
           <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">v2.1 • A4 Portrait</div>
        </header>

        <Toolbar 
          onAddElement={addElement} onOpenAI={() => { setTargetSectionId(null); setIsAIModalOpen(true); }}
          onPrint={handleExportPDF} onImageUpload={(f) => { const r = new FileReader(); r.onload = (e) => addElement(ElementType.IMAGE, e.target?.result as string); r.readAsDataURL(f); }}
          onSaveProject={handleSaveProject} onLoadProject={handleLoadProject} onExportHTML={handleExportHTML} onPreview={() => setIsPreviewModalOpen(true)}
          onViewSource={() => setIsSourceModalOpen(true)} onOpenSettings={() => setIsSettingsModalOpen(true)} 
          onLoadDemo={handleLoadDemo}
          showGrid={showGrid} onToggleGrid={() => setShowGrid(!showGrid)}
          canUndo={historyIndex > 0} canRedo={historyIndex < history.length - 1} onUndo={handleUndo} onRedo={handleRedo}
          onDelete={() => { const newPages = pages.map(p => p.id === currentPageId ? { ...p, elements: (p.elements || []).filter(el => !selectedIds.has(el.id)) } : p); updatePages(newPages); setSelectedIds(new Set()); }}
          onCopy={() => setClipboard(selectedElements)} selectionCount={selectedIds.size} onAlign={handleAlign}
        />

        <PropertiesPanel 
          elements={selectedElements}
          currentPage={currentPage}
          onUpdate={updateElement}
          onDelete={deleteElement}
          onUpdatePage={handleUpdatePage}
        />

        <AIModal 
          isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} onGenerated={handleAIGenerated}
          currentPageType={getCurrentPage().type}
        />

        <SourceViewModal
          isOpen={isSourceModalOpen} onClose={() => setIsSourceModalOpen(false)}
          projectData={{ id: uuidv4(), name: "Projet", version: "2.0", pages, updatedAt: Date.now() }}
        />

        <PreviewModal 
          isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)}
          projectData={{ id: uuidv4(), name: "Manuel Scolaire (Aperçu)", version: "2.1", pages, updatedAt: Date.now() }}
        />

        <SettingsModal 
           isOpen={isSettingsModalOpen}
           onClose={() => setIsSettingsModalOpen(false)}
           settings={settings}
           onSave={(newSettings) => setSettings(newSettings)}
           onReset={() => setSettings(DEFAULT_SETTINGS)}
        />

        <div className="flex-1 overflow-auto flex justify-center p-8">
          {currentPage && (
              <div 
                ref={canvasRef}
                className={`page-a4 bg-white relative transition-transform ${showGrid ? 'bg-grid-pattern' : ''}`}
                style={getPageBackgroundStyle(currentPage)}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={handleCanvasMouseDown}
              >
                  {!showGrid && (!currentPage.background || currentPage.background === 'none') && !currentPage.backgroundImage && <div className="absolute inset-0 pointer-events-none opacity-[0.03] no-print" style={{backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>}

                  {currentElements.map(el => (
                    <div
                      key={el.id}
                      onMouseDown={(e) => handleMouseDown(e, el.id)}
                      onDoubleClick={(e) => { e.stopPropagation(); if ([ElementType.HTML, ElementType.QCM, ElementType.VIDEO, ElementType.THREED_MODEL, ElementType.MIND_MAP, ElementType.CONNECT_DOTS, ElementType.AUDIO].includes(el.type)) setInteractingId(el.id); }}
                      style={{
                        position: 'absolute', left: `${el.x}px`, top: `${el.y}px`, width: `${el.width}px`, height: `${el.height}px`,
                        zIndex: el.style.zIndex,
                        cursor: (dragInfo && selectedIds.has(el.id)) ? 'grabbing' : 'grab',
                        outline: selectedIds.has(el.id) ? '2px solid #6366f1' : 'none',
                      }}
                      className="group"
                    >
                      {selectedIds.has(el.id) && selectedIds.size === 1 && el.type !== ElementType.SEQUENCE_TITLE && (
                         <div className="absolute -bottom-2 -right-2 w-5 h-5 bg-indigo-500 cursor-nwse-resize rounded-full no-print shadow z-[60] border-2 border-white hover:scale-125 transition-transform"
                              onMouseDown={(e) => { e.stopPropagation(); setResizeState({ isResizing: true, startX: e.clientX, startY: e.clientY, initialWidth: el.width, initialHeight: el.height, elementId: el.id }); }} />
                      )}
                      {selectedIds.has(el.id) && selectedIds.size === 1 && el.type === ElementType.SEQUENCE_TITLE && (
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-4 bg-indigo-500 cursor-ns-resize rounded-full no-print shadow z-[60] border-2 border-white"
                               onMouseDown={(e) => { e.stopPropagation(); setResizeState({ isResizing: true, startX: e.clientX, startY: e.clientY, initialWidth: el.width, initialHeight: el.height, elementId: el.id }); }} />
                      )}
                      {resizeState.isResizing && resizeState.elementId === el.id && (
                          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-mono px-2 py-1 rounded shadow-lg z-[100] pointer-events-none whitespace-nowrap no-print">
                              {Math.round(el.width)} × {Math.round(el.height)} px
                          </div>
                      )}
                      {(dragInfo || resizeState.isResizing) && <div className="absolute inset-0 z-50 bg-transparent" />}
                      <ElementRenderer 
                        element={el} isPrint={false}
                        isDragging={dragInfo !== null && selectedIds.has(el.id)}
                        isResizing={resizeState.elementId === el.id}
                        isInteracting={interactingId === el.id}
                        isSelected={selectedIds.has(el.id)}
                        onInteract={() => setInteractingId(el.id)}
                        onOpenAI={(id) => { setTargetSectionId(id); setIsAIModalOpen(true); }}
                        labelPrefix={structureData.numberingMap[el.id]}
                        extraData={el.type === ElementType.TOC ? structureData.tocList : undefined}
                        onNavigate={(pageId) => setCurrentPageId(pageId)}
                      />
                    </div>
                  ))}
              </div>
          )}
        </div>
      </div>
      
      <div className="print-only">
        {pages.map((page) => {
            let pageNum = 0;
            if (page.type === 'standard') {
                pageNum = pages.filter(p => p.type === 'standard').findIndex(p => p.id === page.id) + 1;
            }
            return (
                <div key={page.id} className="page-a4-print" style={getPageBackgroundStyle(page)}>
                   {(page.elements || []).map(el => <div key={el.id} style={{position: 'absolute', left: `${el.x}px`, top: `${el.y}px`, width: `${el.width}px`, height: `${el.height}px`, zIndex: el.style.zIndex}}>
                       <ElementRenderer element={el} isPrint={true} labelPrefix={structureData.numberingMap[el.id]} extraData={el.type === ElementType.TOC ? structureData.tocList : undefined} />
                   </div>)}
                   {page.type === 'standard' && <div className="print-page-number">Page {pageNum}</div>}
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default App;