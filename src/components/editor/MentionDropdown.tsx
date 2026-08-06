'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore, CodexEntry } from '@/stores/useAppStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { User, MapPin, ScrollText, Gem, Search } from 'lucide-react';
import { ensureStringArray } from '@/lib/utils';

const TYPE_ICONS: Record<string, typeof User> = {
  character: User,
  location: MapPin,
  lore: ScrollText,
  item: Gem,
};

const TYPE_COLORS: Record<string, string> = {
  character: 'text-violet-400',
  location: 'text-emerald-400',
  lore: 'text-amber-400',
  item: 'text-cyan-400',
};

interface MentionDropdownProps {
  search: string;
  onSelect: (name: string) => void;
  onClose: () => void;
}

export function MentionDropdown({ search, onSelect, onClose }: MentionDropdownProps) {
  const [entries, setEntries] = useState<CodexEntry[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const token = useAppStore((s) => s.token);
  const activeBookId = useAppStore((s) => s.activeBookId);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) => {
      const nameMatch = e.name.toLowerCase().includes(q);
      const safeAliases = ensureStringArray(e.aliases);
      const aliasMatch = safeAliases.some((a) => a.toLowerCase().includes(q));
      return nameMatch || aliasMatch;
    });
  }, [search, entries]);

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams();
    if (activeBookId) params.set('bookId', activeBookId);
    fetch(`/api/codex?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setEntries(data);
      })
      .catch(() => {});
  }, [token, activeBookId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showMention) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filtered[activeIdx]) {
        e.preventDefault();
        onSelect(filtered[activeIdx].name);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    const showMention = true;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filtered, activeIdx, onSelect, onClose]);

  if (filtered.length === 0) {
    return (
      <div
        ref={containerRef}
        className="absolute left-6 sm:left-10 lg:left-20 top-16 w-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 p-3"
      >
        <p className="text-zinc-500 text-sm text-center">No matching codex entries</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute left-6 sm:left-10 lg:left-20 top-16 w-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-zinc-500">
          <Search className="w-3.5 h-3.5" />
          <span className="text-xs">Reference a codex entry...</span>
        </div>
      </div>
      <ScrollArea className="max-h-64">
        {filtered.slice(0, 10).map((entry, idx) => {
          const Icon = TYPE_ICONS[entry.type] || User;
          const color = TYPE_COLORS[entry.type] || 'text-zinc-400';
          return (
            <button
              key={entry.id}
              className={`w-full px-3 py-2 flex items-start gap-2.5 text-left hover:bg-zinc-800 transition-colors ${
                idx === activeIdx ? 'bg-zinc-800' : ''
              }`}
              onClick={() => onSelect(entry.name)}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200 truncate">{entry.name}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 border-zinc-700 text-zinc-500 shrink-0"
                  >
                    {entry.type}
                  </Badge>
                </div>
                {entry.description && (
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{entry.description}</p>
                )}
                {ensureStringArray(entry.aliases).length > 0 && (
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    aka: {ensureStringArray(entry.aliases).join(', ')}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </ScrollArea>
    </div>
  );
}

// Utility: extract @mentioned names from text
export function extractMentions(text: string): string[] {
  const mentions: string[] = [];
  const regex = /@(\w[\w\s]*?\w|\w)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    mentions.push(match[1].trim());
  }
  return [...new Set(mentions)];
}