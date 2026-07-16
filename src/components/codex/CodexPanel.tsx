'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore, CodexEntry } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  User,
  MapPin,
  ScrollText,
  Gem,
  Pencil,
  Trash2,
  Pin,
  PinOff,
  X,
} from 'lucide-react';

const TYPE_ICONS: Record<string, typeof User> = {
  character: User,
  location: MapPin,
  lore: ScrollText,
  item: Gem,
};

const TYPE_COLORS: Record<string, string> = {
  character: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  location: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  lore: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  item: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

const EMPTY_FORM = {
  type: 'character' as const,
  name: '',
  description: '',
  aliases: '',
  tags: '',
};

export function CodexPanel() {
  const [entries, setEntries] = useState<CodexEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CodexEntry | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const token = useAppStore((s) => s.token);
  const activeBookId = useAppStore((s) => s.activeBookId);
  const activeScene = useAppStore((s) => s.activeScene);
  const setCodexEntries = useAppStore((s) => s.setCodexEntries);
  const setActiveScene = useAppStore((s) => s.setActiveScene);

  // Scene-level codex pinning
  const pinnedIds: string[] = activeScene?.pinnedCodexIds
    ? (typeof activeScene.pinnedCodexIds === 'string'
        ? JSON.parse(activeScene.pinnedCodexIds)
        : activeScene.pinnedCodexIds)
    : [];

  const isPinnedToScene = (entryId: string) => pinnedIds.includes(entryId);

  const handlePinToScene = async (entryId: string) => {
    if (!activeScene?.id || !token) return;
    const current = pinnedIds.includes(entryId)
      ? pinnedIds.filter((id) => id !== entryId)
      : [...pinnedIds, entryId];
    try {
      const res = await fetch(`/api/scenes/${activeScene.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pinnedCodexIds: current }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveScene(data);
      }
    } catch {
      // silent
    }
  };

  const fetchEntries = useCallback(async () => {
    if (!token) return;
    const params = new URLSearchParams();
    if (activeBookId) params.set('bookId', activeBookId);
    if (filterType !== 'all') params.set('type', filterType);
    if (search) params.set('search', search);
    const res = await fetch(`/api/codex?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setEntries(data);
      setCodexEntries(data);
    }
  }, [token, activeBookId, filterType, search, setCodexEntries]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSave = async () => {
    if (!form.name.trim() || !token) return;
    setSaving(true);
    try {
      const body = {
        type: form.type,
        name: form.name.trim(),
        description: form.description.trim(),
        aliases: form.aliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        bookId: activeBookId || null,
      };

      if (editing) {
        await fetch(`/api/codex/${editing.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
      } else {
        await fetch('/api/codex', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
      }

      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      fetchEntries();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry: CodexEntry) => {
    setEditing(entry);
    setForm({
      type: entry.type,
      name: entry.name,
      description: entry.description,
      aliases: entry.aliases.join(', '),
      tags: entry.tags.join(', '),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this codex entry?')) return;
    try {
      await fetch(`/api/codex/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchEntries();
    } catch {
      // silent
    }
  };

  const handleTogglePin = async (entry: CodexEntry) => {
    try {
      await fetch(`/api/codex/${entry.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isPinned: !entry.isPinned }),
      });
      fetchEntries();
    } catch {
      // silent
    }
  };

  const filtered = entries.filter((e) => {
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.aliases.some((a) => a.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-medium text-zinc-300">Codex</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-zinc-500 hover:text-amber-400"
          onClick={() => {
            setEditing(null);
            setForm(EMPTY_FORM);
            setShowForm(true);
          }}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="px-3 py-2 space-y-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <Input
            placeholder="Search codex..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 text-sm"
          />
        </div>
        <Tabs value={filterType} onValueChange={setFilterType}>
          <TabsList className="bg-zinc-900 border border-zinc-800 h-8 w-full">
            <TabsTrigger value="all" className="text-xs h-6 data-[state=active]:bg-zinc-800 text-zinc-400">
              All
            </TabsTrigger>
            <TabsTrigger value="character" className="text-xs h-6 data-[state=active]:bg-zinc-800 text-zinc-400">
              Chars
            </TabsTrigger>
            <TabsTrigger value="location" className="text-xs h-6 data-[state=active]:bg-zinc-800 text-zinc-400">
              Locs
            </TabsTrigger>
            <TabsTrigger value="lore" className="text-xs h-6 data-[state=active]:bg-zinc-800 text-zinc-400">
              Lore
            </TabsTrigger>
            <TabsTrigger value="item" className="text-xs h-6 data-[state=active]:bg-zinc-800 text-zinc-400">
              Items
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Entries List */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-zinc-600 text-sm">No entries found.</p>
            </div>
          ) : (
            filtered.map((entry) => {
              const Icon = TYPE_ICONS[entry.type] || User;
              const color = TYPE_COLORS[entry.type] || '';
              return (
                <div
                  key={entry.id}
                  className="group px-2 py-2 rounded-lg hover:bg-zinc-900/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${
                      entry.type === 'character' ? 'text-violet-400' :
                      entry.type === 'location' ? 'text-emerald-400' :
                      entry.type === 'lore' ? 'text-amber-400' : 'text-cyan-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-zinc-200 truncate">
                          {entry.isPinned && <Pin className="w-3 h-3 inline text-amber-500 mr-1" />}
                          {entry.name}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{entry.description}</p>
                      {entry.aliases.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {entry.aliases.map((alias) => (
                            <span
                              key={alias}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500"
                            >
                              {alias}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 ${isPinnedToScene(entry.id) ? 'text-amber-500' : 'text-zinc-500 hover:text-amber-400'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePinToScene(entry.id);
                        }}
                        title={isPinnedToScene(entry.id) ? 'Unpin from this scene' : 'Pin to this scene for AI context'}
                      >
                        {isPinnedToScene(entry.id) ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(entry);
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-500 hover:text-red-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(entry.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {editing ? 'Edit Codex Entry' : 'New Codex Entry'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as CodexEntry['type'] })}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="character">Character</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="lore">Lore</SelectItem>
                  <SelectItem value="item">Item</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                autoFocus
              />
            </div>

            <Textarea
              placeholder="Description..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 min-h-[120px]"
            />

            <Input
              placeholder="Aliases (comma-separated, e.g. John, Johnny, JC)"
              value={form.aliases}
              onChange={(e) => setForm({ ...form, aliases: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
            />

            <Input
              placeholder="Tags (comma-separated)"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowForm(false)} className="text-zinc-400">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
                className="bg-amber-600 hover:bg-amber-500 text-white"
              >
                {saving ? 'Saving...' : editing ? 'Update' : 'Create Entry'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}