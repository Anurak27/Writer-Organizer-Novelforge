'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Maximize2,
  RefreshCw,
  Minimize2,
  FileText,
  MessageSquare,
  Database,
  Bookmark,
  ListTree,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export type SlashCommand =
  | 'continue'
  | 'expand'
  | 'rewrite'
  | 'shorten'
  | 'summarize'
  | 'chat'
  | 'codex'
  | 'snippets'
  | 'outline';

interface SlashCommandItem {
  command: SlashCommand;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface SlashCommandMenuProps {
  search: string;
  onSelect: (command: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const COMMANDS: SlashCommandItem[] = [
  {
    command: 'continue',
    label: '/continue',
    description: 'Continue writing from the last sentence',
    icon: Play,
  },
  {
    command: 'expand',
    label: '/expand',
    description: 'Add detail and depth to selected text',
    icon: Maximize2,
  },
  {
    command: 'rewrite',
    label: '/rewrite',
    description: 'Rephrase and improve selected text',
    icon: RefreshCw,
  },
  {
    command: 'shorten',
    label: '/shorten',
    description: 'Make selected text more concise',
    icon: Minimize2,
  },
  {
    command: 'summarize',
    label: '/summarize',
    description: 'Generate a summary of this scene',
    icon: FileText,
  },
  {
    command: 'chat',
    label: '/chat',
    description: 'Brainstorm ideas with AI',
    icon: MessageSquare,
  },
  {
    command: 'codex',
    label: '/codex',
    description: 'Search your story bible',
    icon: Database,
  },
  {
    command: 'snippets',
    label: '/snippets',
    description: 'Browse saved text fragments',
    icon: Bookmark,
  },
  {
    command: 'outline',
    label: '/outline',
    description: 'Toggle the outline/plan view',
    icon: ListTree,
  },
];

export function SlashCommandMenu({
  search,
  onSelect,
  onClose,
  position,
}: SlashCommandMenuProps) {
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filteredCommands = useMemo(() => {
    if (!search.trim()) return COMMANDS;
    const q = search.toLowerCase();
    return COMMANDS.filter(
      (cmd) =>
        cmd.command.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q)
    );
  }, [search]);

  // Derive a safe index that clamps to the filtered list bounds.
  // When the list shrinks (user types more), this naturally falls back to 0.
  const safeIndex =
    filteredCommands.length === 0
      ? 0
      : Math.min(highlightedIndex, filteredCommands.length - 1);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (filteredCommands.length === 0) {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev + 1 >= filteredCommands.length ? 0 : prev + 1
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev - 1 < 0 ? filteredCommands.length - 1 : prev - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          onSelect(filteredCommands[safeIndex].command);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, safeIndex, onSelect, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="absolute w-72 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl z-50 overflow-hidden"
      style={{ top: position.top, left: position.left }}
      role="listbox"
      aria-label="Slash commands"
    >
      {filteredCommands.length === 0 ? (
        <div className="px-4 py-3 text-sm text-zinc-500 text-center">
          No commands found
        </div>
      ) : (
        <ScrollArea className="max-h-80">
          <div className="py-1">
            {filteredCommands.map((cmd, index) => {
              const Icon = cmd.icon;
              const isHighlighted = index === safeIndex;
              return (
                <button
                  key={cmd.command}
                  role="option"
                  aria-selected={isHighlighted}
                  className={[
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer',
                    isHighlighted
                      ? 'bg-zinc-800 text-zinc-50'
                      : 'text-zinc-300 hover:bg-zinc-800/60',
                  ].join(' ')}
                  onClick={() => onSelect(cmd.command)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <Icon
                    className={[
                      'h-4 w-4 shrink-0',
                      isHighlighted ? 'text-zinc-300' : 'text-zinc-500',
                    ].join(' ')}
                  />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {cmd.label}
                    </span>
                    <span className="text-xs text-zinc-500 truncate">
                      {cmd.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}