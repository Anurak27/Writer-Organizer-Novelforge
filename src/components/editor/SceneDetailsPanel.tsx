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
} from 'lucide-react';

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
  const statusInfo = SCENE_STATUS_OPTIONS.find((s) => s.value === activeScene.status);
  const wc = activeScene.wordCount || 0;
  const formatWc = wc >= 1000 ? `${(wc / 1000).toFixed(1)}k` : String(wc);

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
        <div className="p-4 space-y-5">
          {/* Scene Title */}
          <DetailSection icon={<FileText className="w-3.5 h-3.5" />} label="Title">
            <p className="text-sm text-zinc-200 font-medium">{activeScene.title}</p>
          </DetailSection>

          {/* Chapter */}
          {currentChapter && (
            <DetailSection icon={<AlignLeft className="w-3.5 h-3.5" />} label="Chapter">
              <p className="text-sm text-zinc-400">{currentChapter.title}</p>
            </DetailSection>
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

          {/* Word Count */}
          <DetailSection icon={<Hash className="w-3.5 h-3.5" />} label="Word Count">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-zinc-200 tabular-nums">{formatWc}</span>
              <span className="text-xs text-zinc-600">words</span>
            </div>
          </DetailSection>

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