'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore, CodexEntry } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ensureStringArray } from '@/lib/utils';
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
  ImagePlus,
  GitBranch,
  Sparkles,
  Bookmark,
  Palette,
  Music,
  TreePine,
  Globe,
  GraduationCap,
  Heart,
  Flame,
  Landmark,
  ChevronDown,
  ChevronRight,
  Settings,
  FolderPlus,
} from 'lucide-react';

// --- Icon registry for all icons used by categories ---
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  User,
  MapPin,
  ScrollText,
  Gem,
  GitBranch,
  Sparkles,
  Bookmark,
  Palette,
  Music,
  TreePine,
  Globe,
  GraduationCap,
  Heart,
  Flame,
  Landmark,
};

// --- Built-in type definitions ---
const BUILT_IN_TYPES: { id: string; label: string; shortLabel: string; color: string; icon: string }[] = [
  { id: 'character', label: 'Character', shortLabel: 'Chars', color: 'violet', icon: 'User' },
  { id: 'location', label: 'Location', shortLabel: 'Locs', color: 'emerald', icon: 'MapPin' },
  { id: 'lore', label: 'Lore', shortLabel: 'Lore', color: 'amber', icon: 'ScrollText' },
  { id: 'item', label: 'Item', shortLabel: 'Items', color: 'cyan', icon: 'Gem' },
  { id: 'subplot', label: 'Subplot', shortLabel: 'Sub', color: 'rose', icon: 'GitBranch' },
  { id: 'theme', label: 'Theme', shortLabel: 'Theme', color: 'sky', icon: 'Sparkles' },
];

// --- Color mapping for badge/icon styling ---
const COLOR_CLASSES: Record<string, { badge: string; icon: string; dot: string }> = {
  violet: { badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20', icon: 'text-violet-400', dot: 'bg-violet-400' },
  emerald: { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: 'text-emerald-400', dot: 'bg-emerald-400' },
  amber: { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: 'text-amber-400', dot: 'bg-amber-400' },
  cyan: { badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: 'text-cyan-400', dot: 'bg-cyan-400' },
  rose: { badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: 'text-rose-400', dot: 'bg-rose-400' },
  sky: { badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20', icon: 'text-sky-400', dot: 'bg-sky-400' },
  pink: { badge: 'bg-pink-500/10 text-pink-400 border-pink-500/20', icon: 'text-pink-400', dot: 'bg-pink-400' },
  fuchsia: { badge: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20', icon: 'text-fuchsia-400', dot: 'bg-fuchsia-400' },
  purple: { badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: 'text-purple-400', dot: 'bg-purple-400' },
  indigo: { badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', icon: 'text-indigo-400', dot: 'bg-indigo-400' },
  teal: { badge: 'bg-teal-500/10 text-teal-400 border-teal-500/20', icon: 'text-teal-400', dot: 'bg-teal-400' },
  lime: { badge: 'bg-lime-500/10 text-lime-400 border-lime-500/20', icon: 'text-lime-400', dot: 'bg-lime-400' },
  orange: { badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: 'text-orange-400', dot: 'bg-orange-400' },
};

const DEFAULT_COLOR = COLOR_CLASSES.violet;

function getColorClasses(color: string) {
  return COLOR_CLASSES[color] || DEFAULT_COLOR;
}

function getTypeConfig(typeId: string, customCategories: CustomCategory[]): { color: string; icon: string; label: string } {
  const builtin = BUILT_IN_TYPES.find((t) => t.id === typeId);
  if (builtin) return { color: builtin.color, icon: builtin.icon, label: builtin.label };
  const custom = customCategories.find((c) => c.id === typeId);
  if (custom) return { color: custom.color, icon: custom.icon, label: custom.name };
  return { color: 'violet', icon: 'User', label: typeId };
}

interface CustomCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  isBuiltin?: boolean;
}

const EMPTY_FORM = {
  type: 'character',
  name: '',
  description: '',
  aliases: '',
  tags: '',
  imagePath: '',
};

export function CodexPanel() {
  const [entries, setEntries] = useState<CodexEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CodexEntry | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formImage, setFormImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Custom categories state
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [othersExpanded, setOthersExpanded] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

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

  // --- Fetch custom categories ---
  const fetchCategories = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/codex/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCustomCategories(data.custom || []);
      }
    } catch {
      // silent
    }
  }, [token]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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
        bookId: activeBookId,
        imagePath: formImage || null,
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
      setFormImage('');
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
      aliases: ensureStringArray(entry.aliases).join(', '),
      tags: ensureStringArray(entry.tags).join(', '),
      imagePath: entry.imagePath || '',
    });
    setFormImage(entry.imagePath || '');
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

  // --- Custom category CRUD ---
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !token) return;
    setCreatingCategory(true);
    try {
      const res = await fetch('/api/codex/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      if (res.ok) {
        setNewCategoryName('');
        await fetchCategories();
      }
    } catch {
      // silent
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm('Delete this custom category? Entries with this type will not be deleted.')) return;
    try {
      const res = await fetch(`/api/codex/categories?id=${encodeURIComponent(catId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await fetchCategories();
        // If we were filtering on this deleted category, reset to 'all'
        if (filterType === catId) {
          setFilterType('all');
        }
      }
    } catch {
      // silent
    }
  };

  const filtered = entries.filter((e) => {
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      const safeAliases = ensureStringArray(e.aliases);
      return (
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        safeAliases.some((a) => a.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Check if a filter type has any entries
  const hasCustomCategories = customCategories.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-medium text-zinc-300">Codex</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
            onClick={() => setShowCategoryManager(true)}
            title="Manage custom categories"
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
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

        {/* Filter tabs row */}
        <div className="flex flex-wrap gap-1">
          <FilterTab
            active={filterType === 'all'}
            onClick={() => setFilterType('all')}
            label="All"
          />
          {BUILT_IN_TYPES.map((bt) => (
            <FilterTab
              key={bt.id}
              active={filterType === bt.id}
              onClick={() => {
                setFilterType(bt.id);
                setOthersExpanded(false);
              }}
              label={bt.shortLabel}
              dot={bt.color}
            />
          ))}
          {/* Others tab (only if custom categories exist) */}
          {hasCustomCategories && (
            <FilterTab
              active={customCategories.some((c) => filterType === c.id)}
              onClick={() => {
                // Toggle between showing first custom or "others" expanded view
                if (customCategories.some((c) => filterType === c.id)) {
                  setFilterType('all');
                  setOthersExpanded(false);
                } else {
                  setOthersExpanded(true);
                }
              }}
              label="Others"
              icon={othersExpanded ? ChevronDown : ChevronRight}
            />
          )}
        </div>

        {/* Expanded "Others" sub-tabs */}
        {othersExpanded && hasCustomCategories && (
          <div className="flex flex-wrap gap-1 pl-2 pt-1 border-l-2 border-zinc-700">
            {customCategories.map((cat) => {
              const IconComp = ICON_MAP[cat.icon] || Bookmark;
              const cc = getColorClasses(cat.color);
              return (
                <button
                  key={cat.id}
                  onClick={() => setFilterType(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    filterType === cat.id
                      ? `${cc.badge} border`
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                >
                  <IconComp className="w-3 h-3" />
                  <span>{cat.name}</span>
                  {filterType === cat.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilterType('all');
                        setOthersExpanded(false);
                      }}
                      className="ml-0.5 hover:text-zinc-200"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        )}
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
              const typeConf = getTypeConfig(entry.type, customCategories);
              const IconComp = ICON_MAP[typeConf.icon] || User;
              const cc = getColorClasses(typeConf.color);
              const isCustom = customCategories.some((c) => c.id === entry.type);

              return (
                <div
                  key={entry.id}
                  className="group px-2 py-2 rounded-lg hover:bg-zinc-900/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-2">
                    {entry.imagePath ? (
                      <img src={entry.imagePath} alt={entry.name} className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5 border border-zinc-700" />
                    ) : (
                      <IconComp className={`w-4 h-4 mt-0.5 shrink-0 ${cc.icon}`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-zinc-200 truncate">
                          {entry.isPinned && <Pin className="w-3 h-3 inline text-amber-500 mr-1" />}
                          {entry.name}
                        </span>
                        {isCustom && (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${cc.badge} shrink-0`}>
                            {typeConf.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{entry.description}</p>
                      {ensureStringArray(entry.aliases).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {ensureStringArray(entry.aliases).map((alias) => (
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
                onValueChange={(v) => setForm({ ...form, type: v })}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {/* Built-in types */}
                  {BUILT_IN_TYPES.map((bt) => {
                    const IconComp = ICON_MAP[bt.icon];
                    const cc = getColorClasses(bt.color);
                    return (
                      <SelectItem key={bt.id} value={bt.id} className="text-zinc-200">
                        <div className="flex items-center gap-2">
                          <IconComp className={`w-3.5 h-3.5 ${cc.icon}`} />
                          <span>{bt.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                  {/* Separator if custom categories exist */}
                  {hasCustomCategories && (
                    <>
                      <div className="border-t border-zinc-700 my-1" />
                      <div className="px-2 py-1 text-[10px] text-zinc-500 uppercase tracking-wider">Custom</div>
                      {customCategories.map((cat) => {
                        const IconComp = ICON_MAP[cat.icon] || Bookmark;
                        const cc = getColorClasses(cat.color);
                        return (
                          <SelectItem key={cat.id} value={cat.id} className="text-zinc-200">
                            <div className="flex items-center gap-2">
                              <IconComp className={`w-3.5 h-3.5 ${cc.icon}`} />
                              <span>{cat.name}</span>
                              <span className={`w-2 h-2 rounded-full ${cc.dot}`} />
                            </div>
                          </SelectItem>
                        );
                      })}
                    </>
                  )}
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

            {/* Image Upload */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Image</label>
              <div className="flex items-center gap-3">
                {formImage ? (
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-zinc-700 shrink-0">
                    <img src={formImage} alt="Entry" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormImage('')}
                      className="absolute top-0 right-0 w-4 h-4 bg-zinc-900/80 rounded-full flex items-center justify-center"
                    >
                      <X className="w-2.5 h-2.5 text-zinc-400" />
                    </button>
                  </div>
                ) : null}
                <label className="flex-1 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f || !token) return;
                      setUploadingImage(true);
                      try {
                        const fd = new FormData();
                        fd.append('file', f);
                        fd.append('purpose', 'codex');
                        if (activeBookId) fd.append('bookId', activeBookId);
                        const res = await fetch('/api/upload', {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}` },
                          body: fd,
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setFormImage(data.url);
                        }
                      } catch { /* ignore */ }
                      setUploadingImage(false);
                    }}
                  />
                  <div className="flex items-center justify-center h-10 border border-dashed border-zinc-700 rounded-md hover:border-zinc-500 transition-colors">
                    {uploadingImage ? (
                      <span className="text-xs text-zinc-500">Uploading...</span>
                    ) : (
                      <><ImagePlus className="w-4 h-4 text-zinc-500 mr-2" /><span className="text-xs text-zinc-500">Add image</span></>
                    )}
                  </div>
                </label>
              </div>
            </div>

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

      {/* Category Manager Dialog */}
      <Dialog open={showCategoryManager} onOpenChange={setShowCategoryManager}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Manage Custom Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-zinc-500">
              Create custom codex types like &quot;Style Guide&quot;, &quot;Festivals&quot;, &quot;Key Elements&quot;, etc. Built-in types (Character, Location, Lore, Item, Subplot, Theme) cannot be removed.
            </p>

            {/* Existing custom categories */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Custom Categories</label>
              {customCategories.length === 0 ? (
                <p className="text-xs text-zinc-600 py-3 text-center">No custom categories yet. Create one below.</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {customCategories.map((cat) => {
                    const IconComp = ICON_MAP[cat.icon] || Bookmark;
                    const cc = getColorClasses(cat.color);
                    return (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between px-3 py-2 rounded-md bg-zinc-800/50 border border-zinc-800"
                      >
                        <div className="flex items-center gap-2">
                          <IconComp className={`w-4 h-4 ${cc.icon}`} />
                          <span className="text-sm text-zinc-200">{cat.name}</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${cc.dot}`} />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-500 hover:text-red-400"
                          onClick={() => handleDeleteCategory(cat.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add new category */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Add New Category</label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Style Guide"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateCategory();
                    }
                  }}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 flex-1"
                  disabled={creatingCategory}
                />
                <Button
                  onClick={handleCreateCategory}
                  disabled={!newCategoryName.trim() || creatingCategory}
                  className="bg-amber-600 hover:bg-amber-500 text-white shrink-0"
                >
                  {creatingCategory ? (
                    <span className="text-xs">...</span>
                  ) : (
                    <FolderPlus className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-zinc-600">
                Color and icon are assigned automatically. Up to 9 custom categories.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => setShowCategoryManager(false)} className="text-zinc-400">
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Small filter tab component ---
function FilterTab({
  active,
  onClick,
  label,
  dot,
  icon: IconComp,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dot?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const cc = dot ? getColorClasses(dot) : null;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
        active
          ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
      }`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${cc?.dot}`} />}
      {IconComp && <IconComp className="w-3 h-3" />}
      <span>{label}</span>
    </button>
  );
}
