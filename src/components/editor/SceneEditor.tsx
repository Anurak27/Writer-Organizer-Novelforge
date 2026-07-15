'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Save, Clock, Sparkles, PanelRight, BookOpen } from 'lucide-react';
import { MentionDropdown, extractMentions } from './MentionDropdown';

export function SceneEditor() {
  const activeSceneId = useAppStore((s) => s.activeSceneId);
  const activeScene = useAppStore((s) => s.activeScene);
  const setActiveScene = useAppStore((s) => s.setActiveScene);
  const setIsSaving = useAppStore((s) => s.setIsSaving);
  const isSaving = useAppStore((s) => s.isSaving);
  const token = useAppStore((s) => s.token);
  const setRightPanelTab = useAppStore((s) => s.setRightPanelTab);
  const setAiPanelOpen = useAppStore((s) => s.setAiPanelOpen);
  const aiPanelOpen = useAppStore((s) => s.aiPanelOpen);
  const chapters = useAppStore((s) => s.chapters);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [content, setContent] = useState('');
  const [showMention, setShowMention] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [wordCount, setWordCount] = useState(0);

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

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;

    setContent(val);
    setSaveStatus('unsaved');

    // Live word count
    const plain = val.replace(/[#*_`~\[\](){}>|\-]/g, ' ').replace(/\s+/g, ' ').trim();
    setWordCount(plain ? plain.split(' ').length : 0);

    // Check for @ mention trigger
    const textBeforeCursor = val.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex >= 0) {
      const searchQuery = textBeforeCursor.slice(atIndex + 1);
      // Only trigger if @ is at start of line, after a space, or at start of text
      if (atIndex === 0 || /\s/.test(textBeforeCursor[atIndex - 1])) {
        setShowMention(true);
        setMentionSearch(searchQuery);
        setMentionCursorPos(atIndex);
        return;
      }
    }

    setShowMention(false);

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

    // Set cursor position after the mention
    setTimeout(() => {
      const newPos = mentionCursorPos + entryName.length + 2; // +2 for @ and space
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);

    // Trigger auto-save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(newContent);
    }, 1000);
  };

  const handleTextSelect = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    if (selected.trim().length > 0) {
      // Show AI actions - the parent will handle this via store
    }
  };

  // Get current chapter for breadcrumb
  const currentChapter = chapters.find((ch) =>
    ch.scenes.some((sc) => sc.id === activeSceneId)
  );
  const currentBookTitle = useAppStore.getState().activeBookId
    ? 'Current Book'
    : '';

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
          <p className="text-zinc-700 text-sm mt-1">Choose a scene from the sidebar, or create a new one.</p>
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
          onMouseUp={handleTextSelect}
          onKeyUp={handleTextSelect}
          placeholder="Start writing your scene here... Use @ to reference characters, locations, or items from your Codex."
          className="w-full h-full bg-transparent text-zinc-200 text-lg leading-relaxed resize-none p-6 sm:p-10 lg:px-20 lg:py-12 focus:outline-none placeholder:text-zinc-700 font-serif"
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
      </div>

      {/* Bottom Bar */}
      <div className="shrink-0 border-t border-zinc-800/50 px-4 sm:px-6 py-2 flex items-center justify-between text-xs text-zinc-600">
        <div className="flex items-center gap-4">
          <span>Status: {activeScene.status.replace('_', ' ')}</span>
          <span>Scene ID: {activeScene.id.slice(0, 8)}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{wordCount} words</span>
          <span>~{Math.max(1, Math.ceil(wordCount / 250))} page{Math.ceil(wordCount / 250) !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}