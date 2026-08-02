'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore, BookSummary, BookDetail } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Pencil,
  Bookmark,
  Upload,
  Download,
  Eye,
  ImagePlus,
  X,
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

const POV_OPTIONS: { value: string; label: string }[] = [
  { value: 'third_past', label: 'Third Person, Past Tense' },
  { value: 'third_present', label: 'Third Person, Present Tense' },
  { value: 'first_past', label: 'First Person, Past Tense' },
  { value: 'first_present', label: 'First Person, Present Tense' },
  { value: 'third_omniscient', label: 'Third Person Omniscient' },
  { value: 'second_past', label: 'Second Person, Past Tense' },
  { value: 'second_present', label: 'Second Person, Present Tense' },
];

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
];

interface BookMeta {
  wordCountGoal: number | null;
  seriesId: string | null;
  coverImagePath: string | null;
}

const PROSE_STYLES = [
  { value: 'literary', label: 'Literary' },
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'flowery', label: 'Flowery / Descriptive' },
  { value: 'pulp', label: 'Pulp / Fast-paced' },
  { value: 'formal', label: 'Formal / Academic' },
  { value: 'conversational', label: 'Conversational' },
];

const TONE_OPTIONS = [
  { value: 'dark', label: 'Dark / Grim' },
  { value: 'humorous', label: 'Humorous / Light' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'suspenseful', label: 'Suspenseful' },
  { value: 'melancholic', label: 'Melancholic' },
  { value: 'whimsical', label: 'Whimsical' },
];

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

  // Advanced create fields
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [newPenName, setNewPenName] = useState('');
  const [newPov, setNewPov] = useState('third_past');
  const [newWordCountGoal, setNewWordCountGoal] = useState('');
  const [newLanguage, setNewLanguage] = useState('en');

  // Edit dialog
  const [showEdit, setShowEdit] = useState(false);
  const [editBookId, setEditBookId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPenName, setEditPenName] = useState('');
  const [editPov, setEditPov] = useState('third_past');
  const [editWordCountGoal, setEditWordCountGoal] = useState('');
  const [editLanguage, setEditLanguage] = useState('en');
  const [editShowAdvanced, setEditShowAdvanced] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Style & Prose (create)
  const [newProseStyle, setNewProseStyle] = useState('');
  const [newTone, setNewTone] = useState('');
  const [newCustomPrompt, setNewCustomPrompt] = useState('');

  // Style & Prose (edit)
  const [editProseStyle, setEditProseStyle] = useState('');
  const [editTone, setEditTone] = useState('');
  const [editCustomPrompt, setEditCustomPrompt] = useState('');

  // Cover upload
  const [newCoverPath, setNewCoverPath] = useState('');
  const [editCoverPath, setEditCoverPath] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);

  // Import
  const [showImport, setShowImport] = useState(false);
  const [importBookId, setImportBookId] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // Export
  const [showExport, setShowExport] = useState(false);
  const [exportBookId, setExportBookId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Cached book metadata for cards (wordCountGoal, seriesId)
  const [bookMeta, setBookMeta] = useState<Record<string, BookMeta>>({});

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

  const resetCreateForm = useCallback(() => {
    setNewTitle('');
    setNewGenre('');
    setNewDescription('');
    setNewPenName('');
    setNewPov('third_past');
    setNewWordCountGoal('');
    setNewLanguage('en');
    setShowAdvanced(false);
  }, []);

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
        body: JSON.stringify({
          title: newTitle,
          genre: newGenre.trim() || null,
          description: newDescription.trim() || null,
          penName: newPenName.trim() || null,
          pov: newPov,
          wordCountGoal: newWordCountGoal ? parseInt(newWordCountGoal, 10) : null,
          language: newLanguage,
        }),
      });
      if (res.ok) {
        resetCreateForm();
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

  const fetchBookDetail = async (id: string): Promise<BookDetail | null> => {
    try {
      const res = await fetch(`/api/books/${id}`, {
        headers: { Authorization: `Bearer ${useAppStore.getState().token}` },
      });
      if (res.ok) {
        const detail: BookDetail = await res.json();
        // Cache the metadata for card display
        setBookMeta((prev) => ({
          ...prev,
          [id]: {
            wordCountGoal: detail.wordCountGoal,
            seriesId: detail.seriesId,
            coverImagePath: detail.coverImagePath,
          },
        }));
        return detail;
      }
    } catch {
      // silent fail
    }
    return null;
  };

  const openEditDialog = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditBookId(id);
    setShowEdit(true);
    setEditLoading(true);
    setEditShowAdvanced(false);

    const detail = await fetchBookDetail(id);
    if (detail) {
      setEditTitle(detail.title);
      setEditGenre(detail.genre || '');
      setEditDescription(detail.description || '');
      setEditPenName(detail.penName || '');
      setEditPov(detail.pov || 'third_past');
      setEditWordCountGoal(detail.wordCountGoal ? String(detail.wordCountGoal) : '');
      setEditLanguage(detail.language || 'en');
      setEditProseStyle(detail.proseStyle || '');
      setEditTone(detail.tone || '');
      setEditCustomPrompt(detail.customPrompt || '');
      setEditCoverPath(detail.coverImagePath || '');
    }
    setEditLoading(false);
  };

  const handleEditSave = async () => {
    if (!editBookId || !editTitle.trim()) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/books/${editBookId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useAppStore.getState().token}`,
        },
        body: JSON.stringify({
          title: editTitle,
          genre: editGenre.trim() || null,
          description: editDescription.trim() || null,
          penName: editPenName.trim() || null,
          pov: editPov,
          wordCountGoal: editWordCountGoal ? parseInt(editWordCountGoal, 10) : null,
          language: editLanguage,
          proseStyle: editProseStyle || null,
          tone: editTone || null,
          customPrompt: editCustomPrompt.trim() || null,
          coverImagePath: editCoverPath || null,
        }),
      });
      if (res.ok) {
        setShowEdit(false);
        setEditBookId(null);
        // Update the cached meta
        setBookMeta((prev) => ({
          ...prev,
          [editBookId]: {
            wordCountGoal: editWordCountGoal ? parseInt(editWordCountGoal, 10) : null,
            seriesId: prev[editBookId]?.seriesId ?? null,
          },
        }));
        fetchBooks();
      }
    } catch {
      // silent fail
    } finally {
      setEditSaving(false);
    }
  };

  const openBook = (id: string) => {
    setActiveBookId(id);
    setView('editor');
  };

  // Upload cover image
  const uploadCover = async (file: File, mode: 'create' | 'edit') => {
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', 'cover');
      const bookId = mode === 'edit' ? editBookId : null;
      if (bookId) formData.append('bookId', bookId);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${useAppStore.getState().token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (mode === 'create') setNewCoverPath(data.url);
        else setEditCoverPath(data.url);
      }
    } catch { /* ignore */ }
    setUploadingCover(false);
  };

  // Handle import
  const handleImport = async () => {
    if (!importBookId || !importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('bookId', importBookId);
      formData.append('mode', 'ai');
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${useAppStore.getState().token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult(data.message);
        fetchBooks();
      } else {
        setImportResult('Error: ' + (data.error || 'Import failed'));
      }
    } catch (err) {
      setImportResult('Error: Import failed');
    }
    setImporting(false);
  };

  // Handle export
  const handleExport = async (format: string, sections: string) => {
    if (!exportBookId) return;
    setExporting(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useAppStore.getState().token}`,
        },
        body: JSON.stringify({ bookId: exportBookId, format, sections }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const book = books.find(b => b.id === exportBookId);
        const ext = format;
        a.download = `${(book?.title || 'export').replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExport(false);
      }
    } catch { /* ignore */ }
    setExporting(false);
  };

  const totalWords = books.reduce((sum, b) => sum + b.totalWords, 0);

  const inputCls =
    'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500';

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
              onClick={() => { setImportBookId(null); setImportFile(null); setImportResult(null); setShowImport(true); }}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <Upload className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setExportBookId(null); setShowExport(true); }}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
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

          {/* Create Dialog */}
          <Dialog open={showCreate} onOpenChange={(open) => {
            if (!open) resetCreateForm();
            setShowCreate(open);
          }}>
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
                  className={inputCls}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <Input
                  placeholder="Genre (optional)"
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  className={inputCls}
                />

                {/* Advanced Options Toggle */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced((prev) => !prev)}
                  className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Advanced options {showAdvanced ? '▲' : '▼'}
                </button>

                {showAdvanced && (
                  <div className="space-y-4 pl-0">
                    <Textarea
                      placeholder="Description / Synopsis (optional)"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      className={`${inputCls} min-h-[80px]`}
                    />
                    <Input
                      placeholder="Pen Name (optional)"
                      value={newPenName}
                      onChange={(e) => setNewPenName(e.target.value)}
                      className={inputCls}
                    />
                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-400">Point of View</label>
                      <Select value={newPov} onValueChange={setNewPov}>
                        <SelectTrigger className={`w-full ${inputCls}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                          {POV_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      type="number"
                      placeholder="Word Count Goal (e.g. 80000)"
                      value={newWordCountGoal}
                      onChange={(e) => setNewWordCountGoal(e.target.value)}
                      className={inputCls}
                      min={0}
                    />
                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-400">Language</label>
                      <Select value={newLanguage} onValueChange={setNewLanguage}>
                        <SelectTrigger className={`w-full ${inputCls}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                          {LANGUAGE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      resetCreateForm();
                      setShowCreate(false);
                    }}
                    className="text-zinc-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={!newTitle.trim() || creating}
                    className="bg-amber-600 hover:bg-amber-500 text-white"
                  >
                    {creating ? 'Creating...' : 'Create'}
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
            {books.map((book) => {
              const meta = bookMeta[book.id];
              const goal = meta?.wordCountGoal;
              const hasSeries = meta?.seriesId != null;
              const coverUrl = meta?.coverImagePath;
              const progress =
                goal && goal > 0
                  ? Math.min(100, (book.totalWords / goal) * 100)
                  : null;
              const goalMet = progress !== null && progress >= 100;

              return (
                <div
                  key={book.id}
                  className={`group relative border rounded-xl cursor-pointer transition-all duration-200 overflow-hidden ${
                    goalMet
                      ? 'bg-emerald-950/30 border-emerald-900/40 hover:border-emerald-800/60'
                      : 'bg-zinc-900/80 border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                  onClick={() => openBook(book.id)}
                >
                  {/* Cover Image */}
                  {coverUrl ? (
                    <div className="h-32 w-full overflow-hidden bg-zinc-800">
                      <img src={coverUrl} alt={book.title} className="w-full h-full object-cover" />
                    </div>
                  ) : null}
                  <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-zinc-100 truncate">{book.title}</h3>
                        {hasSeries && (
                          <Badge
                            variant="outline"
                            className="shrink-0 bg-zinc-800/80 text-zinc-400 border-zinc-700 text-[10px] px-1.5 py-0"
                          >
                            <Bookmark className="w-2.5 h-2.5 mr-0.5" />
                            Series
                          </Badge>
                        )}
                      </div>
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
                          className="text-zinc-300 focus:text-zinc-100"
                          onClick={(e) => { e.stopPropagation(); openEditDialog(book.id, e); }}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-zinc-300 focus:text-zinc-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImportBookId(book.id);
                            setImportFile(null);
                            setImportResult(null);
                            setShowImport(true);
                          }}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Import Document
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-zinc-300 focus:text-zinc-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExportBookId(book.id);
                            setShowExport(true);
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export Book
                        </DropdownMenuItem>
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

                  {/* Word Count Goal Progress */}
                  {goal && goal > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
                        <span>
                          {formatWordCount(book.totalWords)} / {formatWordCount(goal)} words
                        </span>
                        <span>{Math.round(progress ?? 0)}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            goalMet
                              ? 'bg-emerald-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${progress ?? 0}%` }}
                        />
                      </div>
                    </div>
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
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Edit Details Dialog */}
      <Dialog open={showEdit} onOpenChange={(open) => {
        if (!open) setEditBookId(null);
        setShowEdit(open);
      }}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Edit Book Details</DialogTitle>
          </DialogHeader>
          {editLoading ? (
            <div className="py-8 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <Input
                placeholder="Book Title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className={inputCls}
                autoFocus
              />
              <Input
                placeholder="Genre (optional)"
                value={editGenre}
                onChange={(e) => setEditGenre(e.target.value)}
                className={inputCls}
              />

              {/* Advanced Options Toggle */}
              <button
                type="button"
                onClick={() => setEditShowAdvanced((prev) => !prev)}
                className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Advanced options {editShowAdvanced ? '▲' : '▼'}
              </button>

              {editShowAdvanced && (
                <div className="space-y-4 pl-0">
                  <Textarea
                    placeholder="Description / Synopsis (optional)"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className={`${inputCls} min-h-[80px]`}
                  />
                  <Input
                    placeholder="Pen Name (optional)"
                    value={editPenName}
                    onChange={(e) => setEditPenName(e.target.value)}
                    className={inputCls}
                  />
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400">Point of View</label>
                    <Select value={editPov} onValueChange={setEditPov}>
                      <SelectTrigger className={`w-full ${inputCls}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        {POV_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number"
                    placeholder="Word Count Goal (e.g. 80000)"
                    value={editWordCountGoal}
                    onChange={(e) => setEditWordCountGoal(e.target.value)}
                    className={inputCls}
                    min={0}
                  />
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400">Language</label>
                    <Select value={editLanguage} onValueChange={setEditLanguage}>
                      <SelectTrigger className={`w-full ${inputCls}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        {LANGUAGE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cover Upload */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400">Cover Image</label>
                    <div className="flex items-center gap-3">
                      {editCoverPath ? (
                        <div className="relative w-16 h-22 rounded overflow-hidden border border-zinc-700 shrink-0">
                          <img src={editCoverPath} alt="Cover" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setEditCoverPath('')}
                            className="absolute top-0.5 right-0.5 w-5 h-5 bg-zinc-900/80 rounded-full flex items-center justify-center"
                          >
                            <X className="w-3 h-3 text-zinc-400" />
                          </button>
                        </div>
                      ) : null}
                      <label className="flex-1 cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadCover(f, 'edit');
                          }}
                        />
                        <div className={`${inputCls} flex items-center justify-center h-10 border border-dashed border-zinc-700 rounded-md hover:border-zinc-500 transition-colors`}>
                          {uploadingCover ? (
                            <span className="text-xs text-zinc-500">Uploading...</span>
                          ) : (
                            <>
                              <ImagePlus className="w-4 h-4 text-zinc-500 mr-2" />
                              <span className="text-xs text-zinc-500">Choose image</span>
                            </>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Style & Prose */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400">Prose Style</label>
                    <Select value={editProseStyle} onValueChange={setEditProseStyle}>
                      <SelectTrigger className={`w-full ${inputCls}`}>
                        <SelectValue placeholder="Select style..." />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        {PROSE_STYLES.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400">Tone</label>
                    <Select value={editTone} onValueChange={setEditTone}>
                      <SelectTrigger className={`w-full ${inputCls}`}>
                        <SelectValue placeholder="Select tone..." />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        {TONE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400">Custom AI System Prompt</label>
                    <Textarea
                      placeholder="Tell the AI how to write for this book..."
                      value={editCustomPrompt}
                      onChange={(e) => setEditCustomPrompt(e.target.value)}
                      className={`${inputCls} min-h-[60px]`}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowEdit(false);
                    setEditBookId(null);
                  }}
                  className="text-zinc-400"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEditSave}
                  disabled={!editTitle.trim() || editSaving}
                  className="bg-amber-600 hover:bg-amber-500 text-white"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={(open) => { if (!open) { setShowImport(false); setImportResult(null); } }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Import Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-zinc-400">Upload a .txt, .docx, or .pdf file. AI will parse it and fill your Codex and outline automatically.</p>
            {!importBookId && books.length > 0 ? (
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Select Book</label>
                <Select onValueChange={(v) => setImportBookId(v)}>
                  <SelectTrigger className={`w-full ${inputCls}`}>
                    <SelectValue placeholder="Choose a book..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {books.map((b) => (
                      <SelectItem key={b.id} value={b.id} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">{b.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-500 transition-colors">
              <input
                type="file"
                accept=".txt,.docx,.pdf"
                className="hidden"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
              <Upload className="w-8 h-8 text-zinc-500 mb-2" />
              <span className="text-sm text-zinc-400">
                {importFile ? importFile.name : 'Click to select file'}
              </span>
              <span className="text-xs text-zinc-600 mt-1">.txt, .docx, .pdf</span>
            </label>
            {importResult && (
              <p className={`text-sm ${importResult.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>{importResult}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowImport(false)} className="text-zinc-400">Cancel</Button>
              <Button
                onClick={handleImport}
                disabled={!importBookId || !importFile || importing}
                className="bg-amber-600 hover:bg-amber-500 text-white"
              >
                {importing ? 'Importing...' : 'Import with AI'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExport} onOpenChange={(open) => setShowExport(open)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Export Book</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {!exportBookId && books.length > 0 ? (
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Select Book</label>
                <Select onValueChange={(v) => setExportBookId(v)}>
                  <SelectTrigger className={`w-full ${inputCls}`}>
                    <SelectValue placeholder="Choose a book..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {books.map((b) => (
                      <SelectItem key={b.id} value={b.id} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">{b.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Content</label>
              <Select defaultValue="manuscript" onValueChange={() => {}}>
                <SelectTrigger className={`w-full ${inputCls}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="manuscript" className="text-zinc-100">Manuscript only</SelectItem>
                  <SelectItem value="codex" className="text-zinc-100">Codex (Story Bible)</SelectItem>
                  <SelectItem value="outline" className="text-zinc-100">Outline</SelectItem>
                  <SelectItem value="all" className="text-zinc-100">Everything</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-zinc-400">Format</label>
              <div className="grid grid-cols-2 gap-2">
                {[{ fmt: 'pdf', label: 'PDF' }, { fmt: 'docx', label: 'DOCX' }, { fmt: 'epub', label: 'EPUB' }, { fmt: 'txt', label: 'TXT' }].map(({ fmt, label }) => (
                  <Button
                    key={fmt}
                    variant="outline"
                    disabled={!exportBookId || exporting}
                    onClick={() => handleExport(fmt, 'manuscript')}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    {exporting ? 'Exporting...' : label}
                  </Button>
                ))}
              </div>
            </div>

            <Button variant="ghost" onClick={() => setShowExport(false)} className="text-zinc-400 w-full">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}