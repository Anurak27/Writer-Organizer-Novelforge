import { create } from 'zustand';

export type View = 'auth' | 'dashboard' | 'editor' | 'settings' | 'outline' | 'preview';

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

export interface BookDetail extends BookSummary {
  penName: string | null;
  language: string;
  wordCountGoal: number | null;
  pov: string;
  povTense: string;
  synopsis: string | null;
  customPrompt: string | null;
  coverImagePath: string | null;
  proseStyle: string | null;
  tone: string | null;
  seriesId: string | null;
  seriesOrder: number | null;
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
  pov: string | null;
  povTense: string | null;
  pinnedCodexIds: string; // JSON array string
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
  type: string;
  name: string;
  description: string;
  aliases: string[];
  tags: string[];
  metadata: Record<string, string>;
  color: string;
  imagePath: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Snippet {
  id: string;
  bookId: string | null;
  title: string;
  content: string;
  category: string; // general, dialogue, description, action, research
  tags: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  bookId: string | null;
  role: string; // user, assistant, system
  content: string;
  createdAt: string;
}

export interface AiConfig {
  id: string;
  provider: string;
  apiKey: string;
  baseUrl: string | null;
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
  activeBook: BookDetail | null;
  chapters: ChapterWithScenes[];
  activeChapterId: string | null;
  activeSceneId: string | null;

  // Active scene data
  activeScene: Scene | null;
  isSaving: boolean;

  // Codex
  codexEntries: CodexEntry[];

  // Snippets
  snippets: Snippet[];

  // Chat
  chatMessages: ChatMessage[];

  // AI Panel
  aiPanelOpen: boolean;
  aiGeneratedText: string | null;
  aiLoading: boolean;

  // Mobile sidebar
  sidebarOpen: boolean;
  rightPanelTab: 'codex' | 'ai' | 'notes' | 'chat' | 'snippets';

  // Outline view toggle
  outlineView: boolean;

  // Preview modal
  previewOpen: boolean;

  // Actions
  setPreviewOpen: (open: boolean) => void;
  setToken: (token: string | null) => void;
  setView: (view: View) => void;
  setActiveBookId: (id: string | null) => void;
  setActiveBook: (book: BookDetail | null) => void;
  setChapters: (chapters: ChapterWithScenes[]) => void;
  setActiveChapterId: (id: string | null) => void;
  setActiveSceneId: (id: string | null) => void;
  setActiveScene: (scene: Scene | null) => void;
  setIsSaving: (saving: boolean) => void;
  setCodexEntries: (entries: CodexEntry[]) => void;
  setSnippets: (snippets: Snippet[]) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  setAiPanelOpen: (open: boolean) => void;
  setAiGeneratedText: (text: string | null) => void;
  setAiLoading: (loading: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setRightPanelTab: (tab: 'codex' | 'ai' | 'notes' | 'chat' | 'snippets') => void;
  setOutlineView: (open: boolean) => void;
  reset: () => void;
}

const initialState = {
  token: null,
  isAuthenticated: false,
  view: 'auth' as View,
  activeBookId: null,
  activeBook: null,
  chapters: [],
  activeChapterId: null,
  activeSceneId: null,
  activeScene: null,
  isSaving: false,
  codexEntries: [],
  snippets: [],
  chatMessages: [],
  aiPanelOpen: true,
  aiGeneratedText: null,
  aiLoading: false,
  sidebarOpen: true,
  rightPanelTab: 'codex' as const,
  outlineView: false,
  previewOpen: false,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setToken: (token) => set({ token, isAuthenticated: !!token }),
  setView: (view) => set({ view }),
  setActiveBookId: (id) =>
    set({
      activeBookId: id,
      activeBook: null,
      chapters: [],
      activeChapterId: null,
      activeSceneId: null,
      activeScene: null,
      snippets: [],
      chatMessages: [],
    }),
  setActiveBook: (book) => set({ activeBook: book }),
  setChapters: (chapters) => set({ chapters }),
  setActiveChapterId: (id) => set({ activeChapterId: id, activeSceneId: null, activeScene: null }),
  setActiveSceneId: (id) => set({ activeSceneId: id }),
  setActiveScene: (scene) => set({ activeScene: scene }),
  setIsSaving: (saving) => set({ isSaving: saving }),
  setCodexEntries: (entries) => set({ codexEntries: entries }),
  setSnippets: (snippets) => set({ snippets }),
  setChatMessages: (messages) => set({ chatMessages: messages }),
  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),
  setAiPanelOpen: (open) => set({ aiPanelOpen: open }),
  setAiGeneratedText: (text) => set({ aiGeneratedText: text }),
  setAiLoading: (loading) => set({ aiLoading: loading }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setOutlineView: (open) => set({ outlineView: open }),
  setPreviewOpen: (open) => set({ previewOpen: open }),
  reset: () => set(initialState),
}));