'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore, BookSummary } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  BookOpen,
  FileText,
  Settings,
  Trash2,
  PenLine,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-700 text-zinc-300',
  in_progress: 'bg-amber-600/20 text-amber-400 border border-amber-600/30',
  completed: 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30',
  on_hiatus: 'bg-zinc-600/30 text-zinc-400',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  completed: 'Completed',
  on_hiatus: 'On Hiatus',
};

function formatWordCount(words: number): string {
  if (words >= 1000) return `${(words / 1000).toFixed(1)}k`;
  return String(words);
}

export function Bookshelf() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newGenre, setNewGenre] = useState('');
  const [creating, setCreating] = useState(false);

  const setView = useAppStore((s) => s.setView);
  const setActiveBookId = useAppStore((s) => s.setActiveBookId);

  const fetchBooks = useCallback(async () => {
    try {
      const res = await fetch('/api/books', {
        headers: { Authorization: `Bearer ${useAppStore.getState().token}` },
      });
      if (res.ok) setBooks(await res.json());
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useAppStore.getState().token}`,
        },
        body: JSON.stringify({ title: newTitle, genre: newGenre.trim() || null }),
      });
      if (res.ok) {
        setNewTitle('');
        setNewGenre('');
        setShowCreate(false);
        fetchBooks();
      }
    } catch {
      // silent fail
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this book and all its chapters and scenes?')) return;
    try {
      await fetch(`/api/books/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${useAppStore.getState().token}` },
      });
      fetchBooks();
    } catch {
      // silent fail
    }
  };

  const openBook = (id: string) => {
    setActiveBookId(id);
    setView('editor');
  };

  const totalWords = books.reduce((sum, b) => sum + b.totalWords, 0);

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">NovelForge</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('settings')}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <Settings className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats Bar */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-zinc-100">My Books</h2>
            <p className="text-zinc-500 text-sm mt-1">
              {books.length} {books.length === 1 ? 'book' : 'books'} &middot;{' '}
              {formatWordCount(totalWords)} words total
            </p>
          </div>

          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-500 text-white">
                <Plus className="w-4 h-4 mr-2" />
                New Book
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800">
              <DialogHeader>
                <DialogTitle className="text-zinc-100">Create New Book</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <Input
                  placeholder="Book Title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <Input
                  placeholder="Genre (optional)"
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setShowCreate(false)} className="text-zinc-400">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={!newTitle.trim() || creating}
                    className="bg-amber-600 hover:bg-amber-500 text-white"
                  >
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Book Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-zinc-900 rounded-xl border border-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-zinc-400 text-lg font-medium">No books yet</h3>
            <p className="text-zinc-600 text-sm mt-1">Create your first book to start writing.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((book) => (
              <div
                key={book.id}
                className="group relative bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-5 cursor-pointer hover:border-zinc-700 hover:bg-zinc-900 transition-all duration-200"
                onClick={() => openBook(book.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-zinc-100 truncate">{book.title}</h3>
                    {book.genre && (
                      <p className="text-zinc-500 text-sm mt-0.5">{book.genre}</p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                      <DropdownMenuItem
                        className="text-red-400 focus:text-red-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(book.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Book
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {book.description && (
                  <p className="text-zinc-500 text-sm line-clamp-2 mb-4">{book.description}</p>
                )}

                <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-800/50">
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {book.chapterCount} {book.chapterCount === 1 ? 'ch' : 'ch'}
                    </span>
                    <span className="flex items-center gap-1">
                      <PenLine className="w-3.5 h-3.5" />
                      {formatWordCount(book.totalWords)} words
                    </span>
                  </div>
                  <Badge variant="outline" className={STATUS_COLORS[book.status] || ''}>
                    {STATUS_LABELS[book.status] || book.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}