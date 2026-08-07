'use client';

import { useAppStore, type ChapterWithScenes, type Scene } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Check,
  LayoutTemplate,
  Layers,
} from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';

// ── Status badge colors ──────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  outline: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  draft: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  in_progress: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  needs_revision: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  complete: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

function statusLabel(status: string) {
  switch (status) {
    case 'in_progress':
      return 'In Progress';
    case 'needs_revision':
      return 'Needs Revision';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

// ── Inline editable field ────────────────────────────────────────────
function InlineEdit({
  value,
  onSave,
  className = '',
  multiline = false,
  placeholder = '',
}: {
  value: string;
  onSave: (val: string) => void;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (!multiline) inputRef.current.select();
    }
  }, [editing, multiline]);

  const startEditing = useCallback(() => {
    setDraft(value);
    setEditing(true);
  }, [value]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed !== value.trim()) {
      onSave(trimmed);
    }
    // Show saved indicator briefly
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1200);
    return () => clearTimeout(t);
  }, [draft, value, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Escape') {
      setDraft(value);
      setEditing(false);
    }
  };

  if (editing) {
    const shared =
      'bg-zinc-800/80 border border-zinc-700 rounded-md px-2 py-1 text-sm text-zinc-200 outline-none focus:border-amber-500/50 transition-colors w-full';
    return multiline ? (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        className={shared + ' min-h-[60px] resize-none ' + className}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
    ) : (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        className={shared + ' ' + className}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={startEditing}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') startEditing();
      }}
      className={`cursor-text group/edit relative inline-block ${className}`}
    >
      <span className={value ? undefined : 'text-zinc-600 italic'}>
        {value || placeholder}
      </span>
      {/* Hover underline */}
      <span className="absolute bottom-0 left-0 w-full h-px bg-zinc-600 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
      {/* Saved indicator */}
      {saved && (
        <span className="absolute -top-4 right-0 text-[10px] text-emerald-500 flex items-center gap-0.5">
          <Check className="w-3 h-3" />
          Saved
        </span>
      )}
    </span>
  );
}

// ── Scene row ────────────────────────────────────────────────────────
function SceneRow({
  scene,
  index,
  onJump,
}: {
  scene: Scene;
  index: number;
  onJump: (scene: Scene) => void;
}) {
  const preview =
    scene.content && scene.content.length > 0
      ? scene.content.slice(0, 150).trim() + (scene.content.length > 150 ? '…' : '')
      : scene.notes
        ? scene.notes.slice(0, 120).trim() + (scene.notes.length > 120 ? '…' : '')
        : null;

  return (
    <button
      onClick={() => onJump(scene)}
      className="w-full text-left border-l border-zinc-800 pl-4 pr-3 py-3 hover:bg-zinc-900/50 transition-colors group/scene rounded-r-md"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-zinc-600 font-mono tabular-nums w-5 shrink-0">
          {index + 1}.
        </span>
        <span className="text-sm text-zinc-300 group-hover/scene:text-zinc-100 truncate">
          {scene.title}
        </span>
        <span
          className={`text-[10px] px-1.5 py-0 rounded-full border ${STATUS_STYLES[scene.status] || STATUS_STYLES.outline}`}
        >
          {statusLabel(scene.status)}
        </span>
        {scene.wordCount > 0 && (
          <span className="text-[10px] text-zinc-600 ml-auto shrink-0 tabular-nums">
            {scene.wordCount.toLocaleString()}w
          </span>
        )}
      </div>
      {preview && (
        <p className={`text-xs leading-relaxed line-clamp-2 ml-7 ${scene.content ? 'text-zinc-600' : 'text-zinc-600 italic'}`}>
          {scene.notes && !scene.content && <span className="text-zinc-700 mr-1">Notes:</span>}
          {preview}
        </p>
      )}
    </button>
  );
}

// ── Chapter block ────────────────────────────────────────────────────
function ChapterBlock({
  chapter,
  index,
  token,
  onRefreshChapters,
  onJumpToScene,
}: {
  chapter: ChapterWithScenes;
  index: number;
  token: string | null;
  onRefreshChapters: () => void;
  onJumpToScene: (scene: Scene) => void;
}) {
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingSynopsis, setSavingSynopsis] = useState(false);

  const chapterWords = chapter.scenes.reduce((s, sc) => s + sc.wordCount, 0);

  const handleSaveTitle = useCallback(
    async (title: string) => {
      if (!token || !title) return;
      setSavingTitle(true);
      try {
        await fetch(`/api/chapters/${chapter.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title }),
        });
        onRefreshChapters();
      } catch {
        // silent
      } finally {
        setSavingTitle(false);
      }
    },
    [token, chapter.id, onRefreshChapters],
  );

  const handleSaveSynopsis = useCallback(
    async (synopsis: string) => {
      if (!token) return;
      setSavingSynopsis(true);
      try {
        await fetch(`/api/chapters/${chapter.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ synopsis }),
        });
        onRefreshChapters();
      } catch {
        // silent
      } finally {
        setSavingSynopsis(false);
      }
    },
    [token, chapter.id, onRefreshChapters],
  );

  return (
    <div className="border-l-2 border-amber-500/30 pl-4">
      {/* Chapter header */}
      <div className="py-3 pr-3">
        <div className="flex items-center gap-2.5 mb-1">
          <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/25 text-[10px] px-1.5 py-0 h-5 font-medium shrink-0">
            Ch {index + 1}
          </Badge>
          {savingTitle ? (
            <span className="text-sm text-zinc-500">Saving…</span>
          ) : (
            <InlineEdit
              value={chapter.title}
              onSave={handleSaveTitle}
              className="text-sm font-medium text-zinc-200 flex-1 min-w-0"
              placeholder="Chapter title…"
            />
          )}
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 shrink-0">
            <FileText className="w-3 h-3" />
            {chapter.scenes.length}
            <span className="mx-0.5 text-zinc-800">·</span>
            {chapterWords.toLocaleString()}w
          </div>
        </div>
        {savingSynopsis ? (
          <div className="ml-[52px] text-xs text-zinc-500">Saving…</div>
        ) : (
          <div className="ml-[52px]">
            <InlineEdit
              value={chapter.synopsis || ''}
              onSave={handleSaveSynopsis}
              className="text-xs text-zinc-500 leading-relaxed"
              multiline
              placeholder="Add a synopsis…"
            />
          </div>
        )}
      </div>

      {/* Scenes */}
      <div className="space-y-0.5 pb-2">
        {chapter.scenes.map((scene, si) => (
          <SceneRow
            key={scene.id}
            scene={scene}
            index={si}
            onJump={onJumpToScene}
          />
        ))}
        {chapter.scenes.length === 0 && (
          <p className="text-xs text-zinc-700 italic pl-7 py-2">
            No scenes yet
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main OutlineView ─────────────────────────────────────────────────
export function OutlineView() {
  const chapters = useAppStore((s) => s.chapters);
  const activeBookId = useAppStore((s) => s.activeBookId);
  const token = useAppStore((s) => s.token);
  const setOutlineView = useAppStore((s) => s.setOutlineView);
  const setActiveChapterId = useAppStore((s) => s.setActiveChapterId);
  const setActiveSceneId = useAppStore((s) => s.setActiveSceneId);
  const setChapters = useAppStore((s) => s.setChapters);

  const [creatingTemplate, setCreatingTemplate] = useState(false);

  // Derive book title from first chapter's bookId (all share the same)
  const bookTitle = 'Outline';

  const totalWords = chapters.reduce(
    (sum, ch) => sum + ch.scenes.reduce((s, sc) => s + sc.wordCount, 0),
    0,
  );
  const totalScenes = chapters.reduce((s, c) => s + c.scenes.length, 0);

  // Refresh chapters from server
  const refreshChapters = useCallback(async () => {
    if (!activeBookId || !token) return;
    try {
      const res = await fetch(`/api/books/${activeBookId}/chapters`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setChapters(data);
      }
    } catch {
      // silent
    }
  }, [activeBookId, token, setChapters]);

  // Jump to a scene in the editor
  const handleJumpToScene = useCallback(
    (scene: Scene) => {
      setActiveChapterId(scene.chapterId);
      setActiveSceneId(scene.id);
      setOutlineView(false);
    },
    [setActiveChapterId, setActiveSceneId, setOutlineView],
  );

  // Create three-act structure template
  const handleCreateTemplate = useCallback(async () => {
    if (!activeBookId || !token || chapters.length > 0 || creatingTemplate) return;
    setCreatingTemplate(true);

    const acts = [
      { title: 'Act I: Setup' },
      { title: 'Act II: Confrontation' },
      { title: 'Act III: Resolution' },
    ];

    try {
      // Create each chapter, then create one empty scene in each
      for (const act of acts) {
        const chRes = await fetch(`/api/books/${activeBookId}/chapters`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(act),
        });

        if (chRes.ok) {
          const chapter = await chRes.json();
          // Create one empty scene in the act
          await fetch(`/api/chapters/${chapter.id}/scenes`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ title: 'Scene 1' }),
          });
        }
      }
      await refreshChapters();
    } catch {
      // silent
    } finally {
      setCreatingTemplate(false);
    }
  }, [activeBookId, token, chapters.length, creatingTemplate, refreshChapters]);

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-zinc-800/50 bg-zinc-950/90 backdrop-blur-sm flex items-center justify-between px-3 py-2 z-10">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOutlineView(false)}
            className="text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline text-sm">Back to Editor</span>
          </Button>
          <div className="hidden sm:block w-px h-5 bg-zinc-800" />
          <div className="hidden sm:flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-zinc-300">{bookTitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span>{chapters.length} chapters</span>
          <span className="text-zinc-700">·</span>
          <span>{totalScenes} scenes</span>
          <span className="text-zinc-700">·</span>
          <span>{totalWords.toLocaleString()} words</span>
        </div>

        <div className="w-[80px]" /> {/* Spacer for symmetry */}
      </header>

      {/* ── Main content ────────────────────────────────────── */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6">
          {/* Template button when no chapters */}
          {chapters.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Layers className="w-12 h-12 text-zinc-800 mb-4" />
              <h2 className="text-lg font-medium text-zinc-400 mb-2">
                No chapters yet
              </h2>
              <p className="text-sm text-zinc-600 mb-6 max-w-sm">
                Start by creating chapters manually, or use the three-act
                structure template to get going quickly.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateTemplate}
                disabled={creatingTemplate}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 gap-2"
              >
                {creatingTemplate ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                    Creating…
                  </span>
                ) : (
                  <>
                    <LayoutTemplate className="w-4 h-4" />
                    Use Three-Act Structure
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Chapter list */}
          <div className="space-y-6">
            {chapters
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((chapter, index) => (
                <ChapterBlock
                  key={chapter.id}
                  chapter={chapter}
                  index={index}
                  token={token}
                  onRefreshChapters={refreshChapters}
                  onJumpToScene={handleJumpToScene}
                />
              ))}
          </div>

          {/* Bottom spacer */}
          <div className="h-24" />
        </div>
      </ScrollArea>
    </div>
  );
}