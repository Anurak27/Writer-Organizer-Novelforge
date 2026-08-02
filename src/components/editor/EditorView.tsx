'use client';

import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChapterSidebar } from './ChapterSidebar';
import { SceneEditor } from './SceneEditor';
import { OutlineView } from '@/components/outline/OutlineView';
import { CodexPanel } from '@/components/codex/CodexPanel';
import { AiPanel } from '@/components/ai/AiPanel';
import { ChatPanel } from '@/components/ai/ChatPanel';
import { SnippetsPanel } from '@/components/snippets/SnippetsPanel';
import { PreviewModal } from './PreviewModal';
import {
  ArrowLeft,
  BookOpen,
  Database,
  Sparkles,
  StickyNote,
  MessageSquare,
  Bookmark,
  ListTree,
  PanelRightClose,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

export function EditorView() {
  const setView = useAppStore((s) => s.setView);
  const activeBookId = useAppStore((s) => s.activeBookId);
  const chapters = useAppStore((s) => s.chapters);
  const activeScene = useAppStore((s) => s.activeScene);
  const aiPanelOpen = useAppStore((s) => s.aiPanelOpen);
  const setAiPanelOpen = useAppStore((s) => s.setAiPanelOpen);
  const rightPanelTab = useAppStore((s) => s.rightPanelTab);
  const setRightPanelTab = useAppStore((s) => s.setRightPanelTab);
  const outlineView = useAppStore((s) => s.outlineView);
  const setOutlineView = useAppStore((s) => s.setOutlineView);

  // Calculate total word count for the book
  const totalWords = chapters.reduce(
    (sum, ch) => sum + ch.scenes.reduce((s, sc) => s + sc.wordCount, 0),
    0
  );

  // Listen for AI insert events
  useEffect(() => {
    const handleAiInsert = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && activeScene) {
        const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
        if (textarea) {
          const newContent = textarea.value + '\n\n' + detail;
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
          )?.set;
          nativeInputValueSetter?.call(textarea, newContent);
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    };

    const handleSnippetInsert = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && activeScene) {
        const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
        if (textarea) {
          const pos = textarea.selectionStart;
          const before = textarea.value.slice(0, pos);
          const after = textarea.value.slice(textarea.selectionEnd);
          const newContent = before + detail + after;
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
          )?.set;
          nativeInputValueSetter?.call(textarea, newContent);
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          const newPos = pos + detail.length;
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newPos, newPos);
          }, 0);
        }
      }
    };

    window.addEventListener('ai-insert-text', handleAiInsert);
    window.addEventListener('snippet-insert-text', handleSnippetInsert);
    return () => {
      window.removeEventListener('ai-insert-text', handleAiInsert);
      window.removeEventListener('snippet-insert-text', handleSnippetInsert);
    };
  }, [activeScene]);

  // If outline view is active, show it full-page
  if (outlineView) {
    return <OutlineView />;
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Top Nav */}
      <header className="shrink-0 border-b border-zinc-800/50 bg-zinc-950/90 backdrop-blur-sm flex items-center justify-between px-3 py-2 z-10">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('dashboard')}
            className="text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline text-sm">Books</span>
          </Button>
          <div className="hidden sm:block w-px h-5 bg-zinc-800" />
          <div className="hidden sm:flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-zinc-300 max-w-[200px] truncate">
              {chapters.length > 0 ? 'Current Book' : 'Loading...'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span>{chapters.length} chapters</span>
          <span className="text-zinc-700">·</span>
          <span>{chapters.reduce((s, c) => s + c.scenes.length, 0)} scenes</span>
          <span className="text-zinc-700">·</span>
          <span>{totalWords.toLocaleString()} words</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Outline toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${outlineView ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            onClick={() => setOutlineView(!outlineView)}
            title="Toggle Outline View"
          >
            <ListTree className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
            onClick={() => setView('settings')}
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </Button>
          {aiPanelOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
              onClick={() => setAiPanelOpen(false)}
            >
              <PanelRightClose className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chapter Sidebar */}
        <ChapterSidebar />

        {/* Editor */}
        <div className="flex-1 flex overflow-hidden min-w-0">
          <SceneEditor />

          {/* Right Panel (Codex / AI / Chat / Snippets / Notes) */}
          {aiPanelOpen && (
            <div className="w-72 lg:w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col shrink-0">
              <Tabs value={rightPanelTab} onValueChange={(v) => setRightPanelTab(v as 'codex' | 'ai' | 'notes' | 'chat' | 'snippets')} className="flex flex-col h-full">
                <TabsList className="bg-transparent border-b border-zinc-800/50 rounded-none h-auto p-0 shrink-0 overflow-x-auto">
                  <TabsTrigger
                    value="codex"
                    className="flex-1 h-10 rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-amber-500 text-zinc-500 data-[state=active]:text-zinc-200 text-[11px] px-1"
                  >
                    <Database className="w-3.5 h-3.5 mr-1" />
                    Codex
                  </TabsTrigger>
                  <TabsTrigger
                    value="ai"
                    className="flex-1 h-10 rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-amber-500 text-zinc-500 data-[state=active]:text-zinc-200 text-[11px] px-1"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                    AI
                  </TabsTrigger>
                  <TabsTrigger
                    value="chat"
                    className="flex-1 h-10 rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-amber-500 text-zinc-500 data-[state=active]:text-zinc-200 text-[11px] px-1"
                  >
                    <MessageSquare className="w-3.5 h-3.5 mr-1" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger
                    value="snippets"
                    className="flex-1 h-10 rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-amber-500 text-zinc-500 data-[state=active]:text-zinc-200 text-[11px] px-1"
                  >
                    <Bookmark className="w-3.5 h-3.5 mr-1" />
                    Clips
                  </TabsTrigger>
                  <TabsTrigger
                    value="notes"
                    className="flex-1 h-10 rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-amber-500 text-zinc-500 data-[state=active]:text-zinc-200 text-[11px] px-1"
                  >
                    <StickyNote className="w-3.5 h-3.5 mr-1" />
                    Notes
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="codex" className="flex-1 mt-0 overflow-hidden">
                  <CodexPanel />
                </TabsContent>
                <TabsContent value="ai" className="flex-1 mt-0 overflow-hidden">
                  <AiPanel />
                </TabsContent>
                <TabsContent value="chat" className="flex-1 mt-0 overflow-hidden">
                  <ChatPanel />
                </TabsContent>
                <TabsContent value="snippets" className="flex-1 mt-0 overflow-hidden">
                  <SnippetsPanel />
                </TabsContent>
                <TabsContent value="notes" className="flex-1 mt-0 overflow-hidden">
                  <SceneNotes />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      <PreviewModal />
    </div>
  );
}

function SceneNotes() {
  const activeScene = useAppStore((s) => s.activeScene);
  const token = useAppStore((s) => s.token);
  const setActiveScene = useAppStore((s) => s.setActiveScene);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const saveNotes = async (value: string) => {
    if (!activeScene?.id || !token) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/scenes/${activeScene.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes: value }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveScene(data);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotes(val);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => saveNotes(val), 2000);
  };

  if (!activeScene) {
    return (
      <div className="p-4 text-center text-zinc-600 text-sm">
        Select a scene to see its notes.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-medium text-zinc-300">Scene Notes</h3>
        {saving && <span className="text-xs text-zinc-600">Saving...</span>}
      </div>
      <textarea
        value={notes}
        onChange={handleChange}
        placeholder="Jot down ideas, reminders, or outlines for this scene. Notes are excluded from AI context."
        className="flex-1 bg-transparent text-zinc-300 text-sm p-4 resize-none focus:outline-none placeholder:text-zinc-700"
      />
    </div>
  );
}