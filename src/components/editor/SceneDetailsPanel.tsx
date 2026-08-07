'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  AlignLeft,
  Clock,
  Hash,
  Eye,
  CheckCircle2,
  Loader2,
  User,
  Pin,
  PinOff,
  BookOpen,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const SCENE_STATUS_OPTIONS = [
  { value: 'outline', label: 'Outline', color: 'text-zinc-500', bg: 'bg-zinc-800/50' },
  { value: 'draft', label: 'Draft', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { value: 'in_progress', label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { value: 'needs_revision', label: 'Needs Revision', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { value: 'complete', label: 'Complete', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
];

const POV_OPTIONS = [
  { value: '', label: 'Default (from book)' },
  { value: 'first_past', label: '1st Person Past' },
  { value: 'first_present', label: '1st Person Present' },
  { value: 'third_past', label: '3rd Person Past' },
  { value: 'third_present', label: '3rd Person Present' },
  { value: 'third_omniscient', label: '3rd Omniscient' },
];

export function SceneDetailsPanel() {
  const activeScene = useAppStore((s) => s.activeScene);
  const token = useAppStore((s) => s.token);
  const setActiveScene = useAppStore((s) => s.setActiveScene);
  const activeBookId = useAppStore((s) => s.activeBookId);
  const chapters = useAppStore((s) => s.chapters);
  const codexEntries = useAppStore((s) => s.codexEntries);

  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedNotes, setSavedNotes] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const notesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync notes when scene changes
  useEffect(() => {
    if (activeScene) {
      setNotes(activeScene.notes || '');
    }
  }, [activeScene?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveField = useCallback(async (field: string, value: string) => {
    if (!activeScene?.id || !token) return;
    try {
      const res = await fetch(`/api/scenes/${activeScene.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveScene(data);
      }
    } catch { /* silent */ }
  }, [activeScene?.id, token, setActiveScene]);

  const handleNotesChange = (val: string) => {
    setNotes(val);
    if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current);
    notesTimeoutRef.current = setTimeout(async () => {
      setSavingNotes(true);
      await saveField('notes', val);
      setSavingNotes(false);
      setSavedNotes(true);
      setTimeout(() => setSavedNotes(false), 1500);
    }, 2000);
  };

  const handleStatusChange = async (status: string) => {
    if (!activeScene?.id || !token) return;
    setSavingStatus(true);
    await saveField('status', status);
    setSavingStatus(false);
  };

  const handlePovChange = async (pov: string) => {
    if (!activeScene?.id || !token) return;
    await saveField('pov', pov || '');
  };

  if (!activeScene) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-800/50 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-medium text-zinc-300">Scene Details</h3>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-zinc-600 text-sm text-center">Select a scene to view its details.</p>
        </div>
      </div>
    );
  }

  const currentChapter = chapters.find((ch) => ch.id === activeScene.chapterId);
  const sceneIndex = currentChapter?.scenes.findIndex((s) => s.id === activeScene.id) ?? -1;
  const sceneNumber = sceneIndex >= 0 ? sceneIndex + 1 : null;
  const statusInfo = SCENE_STATUS_OPTIONS.find((s) => s.value === activeScene.status);
  const wc = activeScene.wordCount || 0;
  const formatWc = wc >= 1000 ? `${(wc / 1000).toFixed(1)}k` : String(wc);

  // Pinned codex entries
  let pinnedIds: string[] = [];
  try {
    pinnedIds = activeScene.pinnedCodexIds ? JSON.parse(activeScene.pinnedCodexIds) : [];
  } catch { /* ignore */ }
  const pinnedEntries = codexEntries.filter((e) => pinnedIds.includes(e.id));
  const characterEntries = codexEntries.filter((e) => e.type === 'character');

  // Format last edited
  const lastEdited = activeScene.updatedAt
    ? new Date(activeScene.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  const unpinCodex = async (entryId: string) => {
    if (!activeScene?.id || !token) return;
    const updated = pinnedIds.filter((id) => id !== entryId);
    try {
      const res = await fetch(`/api/scenes/${activeScene.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pinnedCodexIds: JSON.stringify(updated) }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveScene(data);
      }
    } catch { /* silent */ }
  };

  const setSceneCharacter = async (characterId: string) => {
    if (!activeScene?.id || !token) return;
    await saveField('pov', characterId || '');
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/50 shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-medium text-zinc-300">Scene Details</h3>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Scene Number + Title */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5" />
              Title
              {sceneNumber !== null && (
                <span className="ml-auto text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0 rounded-md font-medium">Scene {sceneNumber}</span>
              )}
            </div>
            <p className="text-sm text-zinc-200 font-medium">{activeScene.title}</p>
          </div>

          <Separator className="bg-zinc-800/50" />

          {/* Chapter + Synopsis */}
          {currentChapter && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                <BookOpen className="w-3.5 h-3.5" />
                Chapter
              </div>
              <p className="text-sm text-zinc-300 font-medium">{currentChapter.title}</p>
              {currentChapter.synopsis && (
                <p className="text-[11px] text-zinc-500 leading-relaxed mt-1 bg-zinc-900/50 border border-zinc-800/50 rounded-md px-2.5 py-2 line-clamp-3">{currentChapter.synopsis}</p>
              )}
            </div>
          )}

          <Separator className="bg-zinc-800/50" />

          {/* Character / POV Selector */}
          {characterEntries.length > 0 && (
            <>
              <DetailSection icon={<User className="w-3.5 h-3.5" />} label="Character / POV">
                <Select value={activeScene.pov || '_none'} onValueChange={(v) => setSceneCharacter(v === '_none' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs bg-zinc-900 border-zinc-800 text-zinc-300">
                    <SelectValue placeholder="No character set" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="_none" className="text-xs text-zinc-500">No character set</SelectItem>
                    {characterEntries.map((char) => (
                      <SelectItem key={char.id} value={char.id} className="text-xs text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0`} style={{ backgroundColor: char.color || '#888' }} />
                          {char.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DetailSection>
              <Separator className="bg-zinc-800/50" />
            </>
          )}

          {/* Status */}
          <DetailSection
            icon={savingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            label="Status"
          >
            <Select value={activeScene.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-8 text-xs bg-zinc-900 border-zinc-800 text-zinc-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                {SCENE_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className={`text-xs ${opt.color}`}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusInfo && (
              <div className={`mt-2 inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border ${statusInfo.bg} ${statusInfo.color} border-current/20`}>
                {activeScene.status === 'complete' && <CheckCircle2 className="w-2.5 h-2.5" />}
                {statusInfo.label}
              </div>
            )}
          </DetailSection>

          <Separator className="bg-zinc-800/50" />

          {/* POV Override */}
          <DetailSection icon={<Eye className="w-3.5 h-3.5" />} label="POV Override">
            <Select value={activeScene.pov || '_default'} onValueChange={(v) => handlePovChange(v === '_default' ? '' : v)}>
              <SelectTrigger className="h-8 text-xs bg-zinc-900 border-zinc-800 text-zinc-300">
                <SelectValue placeholder="Default (from book)" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                {POV_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value || '_default'} value={opt.value || '_default'} className="text-xs text-zinc-300">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-zinc-600 mt-1">Leave as Default to use the book&apos;s POV setting.</p>
          </DetailSection>

          {/* Word Count + Last Edited */}
          <div className="flex items-center justify-between">
            <DetailSection icon={<Hash className="w-3.5 h-3.5" />} label="Word Count">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-zinc-200 tabular-nums">{formatWc}</span>
                <span className="text-xs text-zinc-600">words</span>
              </div>
            </DetailSection>
            {lastEdited && (
              <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                <Clock className="w-3 h-3" />
                {lastEdited}
              </div>
            )}
          </div>

          <Separator className="bg-zinc-800/50" />

          {/* Pinned Codex Entries */}
          {pinnedEntries.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                <Pin className="w-3.5 h-3.5" />
                Pinned References
                <span className="text-zinc-700">({pinnedEntries.length})</span>
              </div>
              <div className="space-y-1">
                {pinnedEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800/50 rounded-md px-2.5 py-1.5 group/pin">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color || '#888' }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-zinc-300 font-medium truncate block">{entry.name}</span>
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{entry.type}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-zinc-600 hover:text-red-400 opacity-0 group-hover/pin:opacity-100 transition-opacity shrink-0"
                      onClick={() => unpinCodex(entry.id)}
                    >
                      <PinOff className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator className="bg-zinc-800/50" />

          {/* Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                <AlignLeft className="w-3 h-3" />
                Scene Notes
              </div>
              {savingNotes && <span className="text-[10px] text-zinc-600">Saving...</span>}
              {savedNotes && (
                <span className="text-[10px] text-emerald-500 flex items-center gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Saved
                </span>
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Scene outline, beats, reminders, or any notes. These are excluded from AI context."
              className="w-full min-h-[120px] bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-3 py-2 text-sm text-zinc-300 resize-y focus:outline-none focus:border-amber-500/30 placeholder:text-zinc-700 transition-colors"
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Reusable detail section ──────────────────────────────────────
function DetailSection({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}