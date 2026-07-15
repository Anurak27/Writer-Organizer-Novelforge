import { create } from 'zustand';

export type View = 'auth' | 'dashboard' | 'editor' | 'settings';

export interface BookSummary {
  id: string;
  title: string;
  description: string | null;
  genre: string | null;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  totalWords: number;
  chapterCount: number;
  sceneCount: number;
}

export interface Scene {
  id: string;
  chapterId: string;
  title: string;
  content: string;
  notes: string | null;
  status: string;
  wordCount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterWithScenes {
  id: string;
  bookId: string;
  title: string;
  synopsis: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  scenes: Scene[];
}

export interface CodexEntry {
  id: string;
  bookId: string | null;
  type: 'character' | 'location' | 'lore' | 'item';
  name: string;
  description: string;
  aliases: string[];
  tags: string[];
  metadata: Record<string, string>;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiConfig {
  id: string;
  provider: string;
  apiKey: string;
  modelName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AppState {
  // Auth
  token: string | null;
  isAuthenticated: boolean;

  // Navigation
  view: View;

  // Current book data
  activeBookId: string | null;
  chapters: ChapterWithScenes[];
  activeChapterId: string | null;
  activeSceneId: string | null;

  // Active scene data
  activeScene: Scene | null;
  isSaving: boolean;

  // Codex
  codexEntries: CodexEntry[];

  // AI Panel
  aiPanelOpen: boolean;
  aiGeneratedText: string | null;
  aiLoading: boolean;

  // Mobile sidebar
  sidebarOpen: boolean;
  rightPanelTab: 'codex' | 'ai' | 'notes';

  // Actions
  setToken: (token: string | null) => void;
  setView: (view: View) => void;
  setActiveBookId: (id: string | null) => void;
  setChapters: (chapters: ChapterWithScenes[]) => void;
  setActiveChapterId: (id: string | null) => void;
  setActiveSceneId: (id: string | null) => void;
  setActiveScene: (scene: Scene | null) => void;
  setIsSaving: (saving: boolean) => void;
  setCodexEntries: (entries: CodexEntry[]) => void;
  setAiPanelOpen: (open: boolean) => void;
  setAiGeneratedText: (text: string | null) => void;
  setAiLoading: (loading: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setRightPanelTab: (tab: 'codex' | 'ai' | 'notes') => void;
  reset: () => void;
}

const initialState = {
  token: null,
  isAuthenticated: false,
  view: 'auth' as View,
  activeBookId: null,
  chapters: [],
  activeChapterId: null,
  activeSceneId: null,
  activeScene: null,
  isSaving: false,
  codexEntries: [],
  aiPanelOpen: false,
  aiGeneratedText: null,
  aiLoading: false,
  sidebarOpen: true,
  rightPanelTab: 'codex' as const,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setToken: (token) => set({ token, isAuthenticated: !!token }),
  setView: (view) => set({ view }),
  setActiveBookId: (id) => set({ activeBookId: id, chapters: [], activeChapterId: null, activeSceneId: null, activeScene: null }),
  setChapters: (chapters) => set({ chapters }),
  setActiveChapterId: (id) => set({ activeChapterId: id, activeSceneId: null, activeScene: null }),
  setActiveSceneId: (id) => set({ activeSceneId: id }),
  setActiveScene: (scene) => set({ activeScene: scene }),
  setIsSaving: (saving) => set({ isSaving: saving }),
  setCodexEntries: (entries) => set({ codexEntries: entries }),
  setAiPanelOpen: (open) => set({ aiPanelOpen: open }),
  setAiGeneratedText: (text) => set({ aiGeneratedText: text }),
  setAiLoading: (loading) => set({ aiLoading: loading }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  reset: () => set(initialState),
}));