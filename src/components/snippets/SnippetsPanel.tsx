'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore, Snippet } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  MessageSquare,
  Eye,
  Zap,
  BookOpen,
  ArrowDownToLine,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  general: FileText,
  dialogue: MessageSquare,
  description: Eye,
  action: Zap,
  research: BookOpen,
};

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  dialogue: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  description: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  action: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  research: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

const CATEGORY_ICON_COLORS: Record<string, string> = {
  general: 'text-zinc-400',
  dialogue: 'text-violet-400',
  description: 'text-emerald-400',
  action: 'text-amber-400',
  research: 'text-cyan-400',
};

const CATEGORIES = ['all', 'general', 'dialogue', 'description', 'action', 'research'] as const;

const EMPTY_FORM = {
  title: '',
  content: '',
  category: 'general' as Snippet['category'],
  tags: '',
};

export function SnippetsPanel() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Snippet | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const token = useAppStore((s) => s.token);
  const activeBookId = useAppStore((s) => s.activeBookId);

  const fetchSnippets = useCallback(async () => {
    if (!token) return;
    const params = new URLSearchParams();
    if (activeBookId) params.set('bookId', activeBookId);
    if (filterCategory !== 'all') params.set('category', filterCategory);
    const res = await fetch(`/api/snippets?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setSnippets(data);
    }
  }, [token, activeBookId, filterCategory]);

  useEffect(() => {
    fetchSnippets();
  }, [fetchSnippets]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim() || !token) return;
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        bookId: activeBookId || null,
      };

      if (editing) {
        const { bookId: _, ...updateBody } = body;
        await fetch(`/api/snippets/${editing.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updateBody),
        });
      } else {
        await fetch('/api/snippets', {
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
      fetchSnippets();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (snippet: Snippet) => {
    setEditing(snippet);
    setForm({
      title: snippet.title,
      content: snippet.content,
      category: snippet.category,
      tags: snippet.tags.join(', '),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this snippet?')) return;
    try {
      await fetch(`/api/snippets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchSnippets();
    } catch {
      // silent
    }
  };

  const handleInsert = (snippet: Snippet) => {
    window.dispatchEvent(
      new CustomEvent('snippet-insert-text', { detail: snippet.content })
    );
  };

  const handleToggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-medium text-zinc-300">Snippets</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-zinc-500 hover:text-emerald-400"
          onClick={() => {
            setEditing(null);
            setForm(EMPTY_FORM);
            setShowForm(true);
          }}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Category Filter Tabs */}
      <div className="px-3 py-2 shrink-0">
        <Tabs value={filterCategory} onValueChange={setFilterCategory}>
          <TabsList className="bg-zinc-900 border border-zinc-800 h-8 w-full">
            {CATEGORIES.map((cat) => (
              <TabsTrigger
                key={cat}
                value={cat}
                className="text-xs h-6 data-[state=active]:bg-zinc-800 text-zinc-400 capitalize"
              >
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Snippets List */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-1">
          {snippets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-zinc-600 text-sm">No snippets found.</p>
            </div>
          ) : (
            snippets.map((snippet) => {
              const Icon = CATEGORY_ICONS[snippet.category] || FileText;
              const iconColor = CATEGORY_ICON_COLORS[snippet.category] || 'text-zinc-400';
              const badgeColor = CATEGORY_COLORS[snippet.category] || '';
              const isExpanded = expandedId === snippet.id;

              return (
                <div
                  key={snippet.id}
                  className="group px-2 py-2 rounded-lg hover:bg-zinc-900/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-zinc-200 truncate">
                          {snippet.title}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-4 border shrink-0 ${badgeColor}`}
                        >
                          {snippet.category}
                        </Badge>
                      </div>
                      {!isExpanded && (
                        <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5 whitespace-pre-wrap">
                          {snippet.content}
                        </p>
                      )}
                      {isExpanded && (
                        <div className="mt-1">
                          <p className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">
                            {snippet.content}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px] text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInsert(snippet);
                              }}
                            >
                              <ArrowDownToLine className="w-3 h-3 mr-1" />
                              Insert
                            </Button>
                          </div>
                        </div>
                      )}
                      {snippet.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {snippet.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleExpand(snippet.id);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(snippet);
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
                          handleDelete(snippet.id);
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
              {editing ? 'Edit Snippet' : 'New Snippet'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Title *"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                autoFocus
              />
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm({ ...form, category: v as Snippet['category'] })
                }
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="dialogue">Dialogue</SelectItem>
                  <SelectItem value="description">Description</SelectItem>
                  <SelectItem value="action">Action</SelectItem>
                  <SelectItem value="research">Research</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Textarea
              placeholder="Content *"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 min-h-[160px]"
            />

            <Input
              placeholder="Tags (comma-separated)"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowForm(false)}
                className="text-zinc-400"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!form.title.trim() || !form.content.trim() || saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {saving ? 'Saving...' : editing ? 'Update' : 'Create Snippet'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}