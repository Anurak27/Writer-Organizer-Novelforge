'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Clock, Sparkles, PanelRight, BookOpen, ListTree, MessageSquare, Target, ImagePlus, Download, Eye, Bold, Italic, Heading1, Heading2, Quote, Minus, Pilcrow, Type } from 'lucide-react';
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
  const setPreviewOpen = useAppStore((s) => s.setPreviewOpen);

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
    }, 30000);
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

  // Inline image insertion
  const handleInsertImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !token || !activeBookId) return;
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('purpose', 'inline');
        fd.append('bookId', activeBookId);
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (res.ok) {
          const data = await res.json();
          const imgTag = `\n![${file.name}](${data.url})\n`;
          const textarea = textareaRef.current;
          if (textarea) {
            const pos = textarea.selectionStart;
            const before = content.slice(0, pos);
            const after = content.slice(pos);
            const newContent = before + imgTag + after;
            setContent(newContent);
            setTimeout(() => {
              textarea.focus();
              const newPos = pos + imgTag.length;
              textarea.setSelectionRange(newPos, newPos);
            }, 0);
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => saveContent(newContent), 1000);
          }
        }
      } catch { /* ignore */ }
    };
    input.click();
  };

  // Export handler
  const handleExport = async (format: string) => {
    if (!activeBookId || !token) return;
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookId: activeBookId, format, sections: 'manuscript' }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `manuscript.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* ignore */ }
  };

  const formatWordCount = (w: number) => {
    if (w >= 1000) return `${(w / 1000).toFixed(1)}k`;
    return String(w);
  };

  // --- Formatting toolbar helpers ---
  const wrapSelection = (before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);
    const newContent = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(newContent);
    setTimeout(() => {
      textarea.focus();
      if (selected) {
        textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
      } else {
        textarea.setSelectionRange(start + before.length, start + before.length);
      }
    }, 0);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveContent(newContent), 1000);
  };

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const pos = textarea.selectionStart;
    const newContent = content.slice(0, pos) + text + content.slice(pos);
    setContent(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(pos + text.length, pos + text.length);
    }, 0);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveContent(newContent), 1000);
  };

  const insertDialogue = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);
    if (selected) {
      // Wrap selection in smart quotes
      const newContent = content.slice(0, start) + '\u201C' + selected + '\u201D' + content.slice(end);
      setContent(newContent);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 1, start + 1 + selected.length);
      }, 0);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => saveContent(newContent), 1000);
    } else {
      // Insert empty dialogue quotes with cursor between
      insertAtCursor('\u201C\u201D');
      setTimeout(() => {
        textarea.setSelectionRange(start + 1, start + 1);
      }, 0);
    }
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
            onClick={handleInsertImage}
            title="Insert Image"
          >
            <ImagePlus className="w-4 h-4" />
          </Button>

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

      {/* Formatting Toolbar */}
      <div className="shrink-0 border-b border-zinc-800/50 px-2 sm:px-4 py-1.5 flex items-center gap-0.5 overflow-x-auto">
        <FormattingButton title="Bold (Ctrl+B)" icon={<Bold className="w-3.5 h-3.5" />} onClick={() => wrapSelection('**', '**')} />
        <FormattingButton title="Italic (Ctrl+I)" icon={<Italic className="w-3.5 h-3.5" />} onClick={() => wrapSelection('*', '*')} />
        <FormattingButton title="Strikethrough" text="S" textStyle="line-through" onClick={() => wrapSelection('~~', '~~')} />
        <div className="w-px h-5 bg-zinc-800 mx-1" />
        <FormattingButton title="Heading 1" icon={<Heading1 className="w-3.5 h-3.5" />} onClick={() => wrapSelection('# ', '')} />
        <FormattingButton title="Heading 2" icon={<Heading2 className="w-3.5 h-3.5" />} onClick={() => wrapSelection('## ', '')} />
        <FormattingButton title="Quote" icon={<Quote className="w-3.5 h-3.5" />} onClick={() => wrapSelection('> ', '')} />
        <div className="w-px h-5 bg-zinc-800 mx-1" />
        <FormattingButton title="Dialogue \u201C...\u201D" icon={<Type className="w-3.5 h-3.5" />} onClick={insertDialogue} />
        <FormattingButton title="Em dash \u2014" text="\u2014" onClick={() => insertAtCursor('\u2014')} />
        <FormattingButton title="Ellipsis \u2026" text="\u2026" onClick={() => insertAtCursor('\u2026')} />
        <FormattingButton title="En dash \u2013" text="\u2013" onClick={() => insertAtCursor('\u2013')} />
        <div className="w-px h-5 bg-zinc-800 mx-1" />
        <FormattingButton title="Horizontal rule" icon={<Minus className="w-3.5 h-3.5" />} onClick={() => insertAtCursor('\n---\n')} />
        <FormattingButton title="Paragraph break" icon={<Pilcrow className="w-3.5 h-3.5" />} onClick={() => insertAtCursor('\n\n')} />
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
              e.preventDefault();
              wrapSelection('**', '**');
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
              e.preventDefault();
              wrapSelection('*', '*');
            }
          }}
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
          <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-300 h-6 text-xs" onClick={() => handleExport('pdf')}><Download className="w-3 h-3 mr-1" />PDF</Button>
          <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-300 h-6 text-xs" onClick={() => handleExport('docx')}><Download className="w-3 h-3 mr-1" />DOCX</Button>
          <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-300 h-6 text-xs" onClick={() => setPreviewOpen(true)}><Eye className="w-3 h-3 mr-1" />Preview</Button>
        </div>
      </div>
    </div>
  );
}

// --- Formatting Toolbar Button ---
function FormattingButton({
  title,
  icon,
  text,
  textStyle,
  onClick,
}: {
  title: string;
  icon?: React.ReactNode;
  text?: string;
  textStyle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      onMouseDown={(e) => e.preventDefault()} // prevent textarea blur
      className="h-7 min-w-7 px-1.5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/70 transition-colors"
    >
      {icon ? (
        icon
      ) : (
        <span className={`text-xs font-medium ${textStyle || ''}`}>{text}</span>
      )}
    </button>
  );
}