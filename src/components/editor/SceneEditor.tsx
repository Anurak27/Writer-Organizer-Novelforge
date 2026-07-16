'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Clock, Sparkles, PanelRight, BookOpen, ListTree, MessageSquare, Target } from 'lucide-react';
import { MentionDropdown, extractMentions } from './MentionDropdown';
import { SlashCommandMenu, SlashCommand } from './SlashCommandMenu';

export function SceneEditor() {
  const activeSceneId = useAppStore((s) => s.activeSceneId);
  const activeScene = useAppStore((s) => s.activeScene);
  const setActiveScene = useAppStore((s) => s.setActiveScene);
  const setIsSaving = useAppStore((s) => s.setIsSaving);
  const isSaving = useAppStore((s) => s.isSaving);
  const token = useAppStore((s) => s.token);
  const activeBookId = useAppStore((s) => s.activeBookId);
  const setRightPanelTab = useAppStore((s) => s.setRightPanelTab);
  const setAiPanelOpen = useAppStore((s) => s.setAiPanelOpen);
  const aiPanelOpen = useAppStore((s) => s.aiPanelOpen);
  const chapters = useAppStore((s) => s.chapters);
  const setAiLoading = useAppStore((s) => s.setAiLoading);
  const aiLoading = useAppStore((s) => s.aiLoading);
  const setOutlineView = useAppStore((s) => s.setOutlineView);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [content, setContent] = useState('');
  const [showMention, setShowMention] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [wordCount, setWordCount] = useState(0);

  // Slash command state
  const [showSlash, setShowSlash] = useState(false);
  const [slashSearch, setSlashSearch] = useState('');
  const [slashCursorPos, setSlashCursorPos] = useState(0);
  const [slashPosition, setSlashPosition] = useState({ top: 0, left: 0 });

  // Fetch scene data when activeSceneId changes
  useEffect(() => {
    if (!activeSceneId || !token) return;
    fetch(`/api/scenes/${activeSceneId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setActiveScene(data);
        setContent(data.content || '');
        setWordCount(data.wordCount || 0);
      })
      .catch(() => {});
  }, [activeSceneId, token, setActiveScene]);

  const saveContent = useCallback(
    async (text: string) => {
      if (!activeSceneId || !token) return;
      setIsSaving(true);
      setSaveStatus('saving');
      try {
        const res = await fetch(`/api/scenes/${activeSceneId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: text }),
        });
        if (res.ok) {
          const data = await res.json();
          setActiveScene(data);
          setWordCount(data.wordCount);
          setSaveStatus('saved');
        }
      } catch {
        setSaveStatus('unsaved');
      } finally {
        setIsSaving(false);
      }
    },
    [activeSceneId, token, setActiveScene, setIsSaving]
  );

  const callAiAction = useCallback(
    async (action: string, text?: string) => {
      if (!token) return;
      setAiLoading(true);
      try {
        const mentionedNames = activeScene?.content
          ? extractMentions(activeScene.content)
          : [];
        const body: Record<string, unknown> = {
          action,
          text: text || activeScene?.content || '',
          sceneContent: activeScene?.content || '',
          mentionedNames,
          bookId: activeBookId,
          sceneId: activeSceneId,
        };
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          console.error(data.error);
          return;
        }
        if (action === 'summarize') {
          // Save summary as scene notes
          await fetch(`/api/scenes/${activeSceneId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ notes: data.result }),
          });
          const updated = { ...activeScene!, notes: data.result };
          setActiveScene(updated);
        } else {
          // Insert into editor
          window.dispatchEvent(
            new CustomEvent('ai-insert-text', { detail: data.result })
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setAiLoading(false);
      }
    },
    [token, activeScene, activeBookId, activeSceneId, setAiLoading, setActiveScene]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;

    setContent(val);
    setSaveStatus('unsaved');

    // Live word count
    const plain = val.replace(/[#*_`~\[\](){}>|\-]/g, ' ').replace(/\s+/g, ' ').trim();
    setWordCount(plain ? plain.split(' ').length : 0);

    // Check for slash command trigger
    const textBeforeCursor = val.slice(0, cursorPos);
    const slashIndex = textBeforeCursor.lastIndexOf('/');
    if (slashIndex >= 0) {
      const slashSearchQuery = textBeforeCursor.slice(slashIndex + 1);
      if (slashIndex === 0 || /\s/.test(textBeforeCursor[slashIndex - 1])) {
        if (!slashSearchQuery.includes(' ')) {
          setShowSlash(true);
          setSlashSearch(slashSearchQuery);
          setSlashCursorPos(slashIndex);
          // Calculate dropdown position
          const textarea = textareaRef.current;
          if (textarea) {
            const lines = val.slice(0, slashIndex).split('\n');
            const lineIndex = lines.length - 1;
            const charInLine = lines[lineIndex].length;
            const lineHeight = 29.7; // approx 18px * 1.85
            const charWidth = 10.8; // approx for 18px serif
            const style = getComputedStyle(textarea);
            const paddingLeft = parseFloat(style.paddingLeft) || 40;
            const paddingTop = parseFloat(style.paddingTop) || 48;
            setSlashPosition({
              top: paddingTop + lineIndex * lineHeight + lineHeight,
              left: paddingLeft + charInLine * charWidth,
            });
          }
          setShowMention(false);
          // Don't return — let the auto-save debounce continue
        } else {
          setShowSlash(false);
        }
      } else {
        setShowSlash(false);
      }
    } else {
      setShowSlash(false);
    }

    // Check for @ mention trigger (only if no slash active)
    if (!showSlash) {
      const atIndex = textBeforeCursor.lastIndexOf('@');
      if (atIndex >= 0) {
        const searchQuery = textBeforeCursor.slice(atIndex + 1);
        if (atIndex === 0 || /\s/.test(textBeforeCursor[atIndex - 1])) {
          setShowMention(true);
          setMentionSearch(searchQuery);
          setMentionCursorPos(atIndex);
        } else {
          setShowMention(false);
        }
      } else {
        setShowMention(false);
      }
    }

    // Auto-save debounce
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(val);
    }, 3000);
  };

  const handleMentionSelect = (entryName: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const beforeMention = content.slice(0, mentionCursorPos);
    const afterMention = content.slice(textarea.selectionStart);
    const newContent = `${beforeMention}@${entryName} ${afterMention}`;

    setContent(newContent);
    setShowMention(false);

    setTimeout(() => {
      const newPos = mentionCursorPos + entryName.length + 2;
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(newContent);
    }, 1000);
  };

  const handleSlashSelect = (command: string) => {
    setShowSlash(false);

    // Remove the /command from the editor
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const beforeSlash = content.slice(0, slashCursorPos);
    const afterSlash = content.slice(textarea.selectionStart);
    const newContent = `${beforeSlash}${afterSlash}`;
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const pos = beforeSlash.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);

    // Execute the command
    const cmd = command as SlashCommand;
    if (cmd === 'continue') {
      callAiAction('continue');
    } else if (cmd === 'expand' || cmd === 'rewrite' || cmd === 'shorten') {
      // For these, switch to AI panel so user can select text and trigger
      setRightPanelTab('ai');
      setAiPanelOpen(true);
    } else if (cmd === 'summarize') {
      callAiAction('summarize');
    } else if (cmd === 'chat') {
      setRightPanelTab('chat');
      setAiPanelOpen(true);
    } else if (cmd === 'codex') {
      setRightPanelTab('codex');
      setAiPanelOpen(true);
    } else if (cmd === 'snippets') {
      setRightPanelTab('snippets');
      setAiPanelOpen(true);
    } else if (cmd === 'outline') {
      setOutlineView(true);
    }
  };

  // Get current chapter for breadcrumb
  const currentChapter = chapters.find((ch) =>
    ch.scenes.some((sc) => sc.id === activeSceneId)
  );

  const formatWordCount = (w: number) => {
    if (w >= 1000) return `${(w / 1000).toFixed(1)}k`;
    return String(w);
  };

  if (!activeScene) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
          <h3 className="text-zinc-600 text-lg font-medium">Select a scene to start writing</h3>
          <p className="text-zinc-700 text-sm mt-1">
            Choose a scene from the sidebar, or create a new one.
          </p>
          <p className="text-zinc-800 text-xs mt-4">
            Type <kbd className="px-1.5 py-0.5 bg-zinc-900 rounded text-zinc-500 border border-zinc-800">/</kbd> for commands &middot;{' '}
            <kbd className="px-1.5 py-0.5 bg-zinc-900 rounded text-zinc-500 border border-zinc-800">@</kbd> for codex mentions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 relative min-w-0">
      {/* Scene Header */}
      <div className="shrink-0 border-b border-zinc-800/50 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-zinc-200 truncate">{activeScene.title}</h2>
            {currentChapter && (
              <p className="text-xs text-zinc-600 truncate">{currentChapter.title}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            {saveStatus === 'saved' && (
              <>
                <Clock className="w-3 h-3" />
                <span>Saved</span>
              </>
            )}
            {saveStatus === 'saving' && (
              <>
                <Save className="w-3 h-3 animate-pulse" />
                <span>Saving...</span>
              </>
            )}
            {saveStatus === 'unsaved' && (
              <>
                <Save className="w-3 h-3 text-amber-500" />
                <span className="text-amber-500">Unsaved</span>
              </>
            )}
          </div>

          <Badge variant="outline" className="text-zinc-500 border-zinc-800 text-xs px-2 py-0.5">
            {formatWordCount(wordCount)} words
          </Badge>

          {aiLoading && (
            <Badge variant="outline" className="text-amber-400 border-amber-600/30 text-xs px-2 py-0.5 animate-pulse">
              AI thinking...
            </Badge>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
            onClick={() => setOutlineView(true)}
            title="Outline View"
          >
            <ListTree className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-500 hover:text-amber-400"
            onClick={() => {
              setRightPanelTab('ai');
              setAiPanelOpen(!aiPanelOpen);
            }}
          >
            <Sparkles className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
            onClick={() => {
              setRightPanelTab('codex');
              setAiPanelOpen(!aiPanelOpen);
            }}
          >
            <PanelRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          placeholder="Start writing your scene here... Type / for commands, @ to reference Codex entries."
          className="scene-editor-textarea w-full h-full bg-transparent text-zinc-200 text-lg leading-relaxed resize-none p-6 sm:p-10 lg:px-20 lg:py-12 focus:outline-none placeholder:text-zinc-700 font-serif"
          style={{ fontSize: '18px', lineHeight: '1.85' }}
          spellCheck
        />

        {/* Mention Dropdown */}
        {showMention && (
          <MentionDropdown
            search={mentionSearch}
            onSelect={handleMentionSelect}
            onClose={() => setShowMention(false)}
          />
        )}

        {/* Slash Command Menu */}
        {showSlash && (
          <SlashCommandMenu
            search={slashSearch}
            onSelect={handleSlashSelect}
            onClose={() => setShowSlash(false)}
            position={slashPosition}
          />
        )}
      </div>

      {/* Bottom Bar */}
      <div className="shrink-0 border-t border-zinc-800/50 px-4 sm:px-6 py-2 flex items-center justify-between text-xs text-zinc-600">
        <div className="flex items-center gap-4">
          <span>Status: {activeScene.status.replace('_', ' ')}</span>
          <span className="hidden sm:inline">Type / for commands</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{wordCount} words</span>
          <span>~{Math.max(1, Math.ceil(wordCount / 250))} page{Math.ceil(wordCount / 250) !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}