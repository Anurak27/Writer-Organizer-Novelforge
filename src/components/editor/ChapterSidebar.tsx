'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore, ChapterWithScenes, Scene } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  FileText,
  BookOpen,
  MoreVertical,
  Trash2,
  Pencil,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SCENE_STATUS_COLORS: Record<string, string> = {
  outline: 'text-zinc-500',
  draft: 'text-zinc-400',
  in_progress: 'text-amber-400',
  needs_revision: 'text-orange-400',
  complete: 'text-emerald-400',
};

export function ChapterSidebar() {
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [showNewChapter, setShowNewChapter] = useState(false);
  const [showNewScene, setShowNewScene] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [renaming, setRenaming] = useState<{ type: 'chapter' | 'scene'; id: string } | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  const activeBookId = useAppStore((s) => s.activeBookId);
  const chapters = useAppStore((s) => s.chapters);
  const setChapters = useAppStore((s) => s.setChapters);
  const activeChapterId = useAppStore((s) => s.activeChapterId);
  const activeSceneId = useAppStore((s) => s.activeSceneId);
  const setActiveChapterId = useAppStore((s) => s.setActiveChapterId);
  const setActiveSceneId = useAppStore((s) => s.setActiveSceneId);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const token = useAppStore((s) => s.token);

  const [initialExpandDone, setInitialExpandDone] = useState(false);

  useEffect(() => {
    if (!activeBookId || !token) return;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`/api/books/${activeBookId}/chapters`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setChapters(data);
          if (data.length > 0 && !initialExpandDone) {
            setInitialExpandDone(true);
            setExpandedChapters(new Set([data[0].id]));
          }
        }
      } catch {
        // silent
      }
    })();

    return () => controller.abort();
  }, [activeBookId, token, setChapters, initialExpandDone]);

  const fetchChapters = useCallback(async () => {
    // Re-trigger by cycling the book ID
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

  const toggleChapter = (id: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createChapter = async () => {
    if (!newTitle.trim() || !token) return;
    try {
      const res = await fetch(`/api/books/${activeBookId}/chapters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        setNewTitle('');
        setShowNewChapter(false);
        fetchChapters();
      }
    } catch {
      // silent
    }
  };

  const createScene = async (chapterId: string) => {
    if (!newTitle.trim() || !token) return;
    try {
      const res = await fetch(`/api/chapters/${chapterId}/scenes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        setNewTitle('');
        setShowNewScene(null);
        fetchChapters();
      }
    } catch {
      // silent
    }
  };

  const deleteChapter = async (id: string) => {
    if (!confirm('Delete this chapter and all its scenes?')) return;
    try {
      await fetch(`/api/chapters/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchChapters();
    } catch {
      // silent
    }
  };

  const deleteScene = async (id: string) => {
    if (!confirm('Delete this scene?')) return;
    try {
      await fetch(`/api/scenes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchChapters();
    } catch {
      // silent
    }
  };

  const handleRename = async () => {
    if (!renaming || !renameTitle.trim() || !token) return;
    try {
      const url = renaming.type === 'chapter'
        ? `/api/chapters/${renaming.id}`
        : `/api/scenes/${renaming.id}`;
      await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: renameTitle }),
      });
      setRenaming(null);
      setRenameTitle('');
      fetchChapters();
    } catch {
      // silent
    }
  };

  const selectScene = (chapterId: string, sceneId: string) => {
    setActiveChapterId(chapterId);
    setActiveSceneId(sceneId);
  };

  if (!sidebarOpen) {
    return (
      <div className="w-10 border-r border-zinc-800 bg-zinc-950 flex flex-col items-center pt-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          className="text-zinc-500 hover:text-zinc-300 h-8 w-8"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-64 lg:w-72 border-r border-zinc-800 bg-zinc-950 flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="px-3 py-3 border-b border-zinc-800/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
          <BookOpen className="w-3.5 h-3.5" />
          Chapters
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNewChapter(true)}
            className="h-7 w-7 text-zinc-500 hover:text-amber-400"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
          >
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Chapter List */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {chapters.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-zinc-600 text-sm">No chapters yet.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewChapter(true)}
                className="mt-2 text-amber-500 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Chapter
              </Button>
            </div>
          ) : (
            chapters.map((chapter, chIdx) => (
              <div key={chapter.id}>
                {/* Chapter Row */}
                <div
                  className={`group flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-zinc-900 ${
                    activeChapterId === chapter.id && !activeSceneId ? 'bg-zinc-900' : ''
                  }`}
                  onClick={() => {
                    toggleChapter(chapter.id);
                    if (expandedChapters.has(chapter.id)) {
                      setActiveChapterId(chapter.id);
                      setActiveSceneId(null);
                    }
                  }}
                >
                  {expandedChapters.has(chapter.id) ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                  )}
                  <span className="text-xs text-zinc-600 font-mono w-5 shrink-0">{chIdx + 1}</span>
                  <span className="text-sm text-zinc-300 truncate flex-1">{chapter.title}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 w-44">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowNewScene(chapter.id);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Scene
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenaming({ type: 'chapter', id: chapter.id });
                          setRenameTitle(chapter.title);
                        }}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <Separator className="my-1 bg-zinc-800" />
                      <DropdownMenuItem
                        className="text-red-400 focus:text-red-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChapter(chapter.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Chapter
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Scenes */}
                {expandedChapters.has(chapter.id) && (
                  <div className="ml-4 border-l border-zinc-800/50">
                    {chapter.scenes.map((scene, scIdx) => (
                      <div
                        key={scene.id}
                        className={`group flex items-center gap-2 pl-3 pr-2 py-1.5 cursor-pointer hover:bg-zinc-900/80 rounded-r-md mr-1 ${
                          activeSceneId === scene.id ? 'bg-zinc-900' : ''
                        }`}
                        onClick={() => selectScene(chapter.id, scene.id)}
                      >
                        <FileText className={`w-3.5 h-3.5 shrink-0 ${SCENE_STATUS_COLORS[scene.status] || 'text-zinc-500'}`} />
                        <span className="text-sm text-zinc-400 truncate flex-1">{scene.title}</span>
                        <span className="text-[10px] text-zinc-600 font-mono shrink-0">{scene.wordCount || 0}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            >
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 w-40">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenaming({ type: 'scene', id: scene.id });
                                setRenameTitle(scene.title);
                              }}
                            >
                              <Pencil className="w-4 h-4 mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-400 focus:text-red-300"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteScene(scene.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Scene
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNewScene(chapter.id)}
                      className="ml-3 text-zinc-600 hover:text-amber-400 text-xs h-7"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Scene
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* New Chapter Dialog */}
      <Dialog open={showNewChapter} onOpenChange={setShowNewChapter}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">New Chapter</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Chapter title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && createChapter()}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowNewChapter(false)} className="text-zinc-400">
              Cancel
            </Button>
            <Button onClick={createChapter} disabled={!newTitle.trim()} className="bg-amber-600 hover:bg-amber-500 text-white">
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Scene Dialog */}
      <Dialog open={!!showNewScene} onOpenChange={() => setShowNewScene(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">New Scene</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Scene title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && showNewScene && createScene(showNewScene)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowNewScene(null)} className="text-zinc-400">
              Cancel
            </Button>
            <Button
              onClick={() => showNewScene && createScene(showNewScene)}
              disabled={!newTitle.trim()}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renaming} onOpenChange={() => setRenaming(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Rename</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenaming(null)} className="text-zinc-400">
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!renameTitle.trim()} className="bg-amber-600 hover:bg-amber-500 text-white">
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}