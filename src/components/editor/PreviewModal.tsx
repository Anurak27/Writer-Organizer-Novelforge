'use client';

import { useAppStore } from '@/stores/useAppStore';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PreviewModal() {
  const previewOpen = useAppStore((s) => s.previewOpen);
  const setPreviewOpen = useAppStore((s) => s.setPreviewOpen);
  const chapters = useAppStore((s) => s.chapters);
  const activeBook = useAppStore((s) => s.activeBook);

  if (!previewOpen) return null;

  const renderInlineImages = (text: string) => {
    const parts = text.split(/(!\[[^\]]*\]\([^)]+\))/g);
    return parts.map((part, i) => {
      const imgMatch = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgMatch) {
        return <img key={i} src={imgMatch[2]} alt={imgMatch[1]} className="max-w-md mx-auto my-4 rounded-lg border border-zinc-800" />;
      }
      return part.split('\n').map((line, j) => (
        <p key={`${i}-${j}`} className="mb-3">{line}</p>
      ));
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">{activeBook?.title || 'Manuscript Preview'}</h2>
            {activeBook?.penName && <p className="text-sm text-zinc-500">by {activeBook.penName}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Formatted preview</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-zinc-700"
              onClick={() => setPreviewOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content - formatted like a book page */}
        <div className="flex-1 overflow-y-auto p-8 sm:p-12">
          <div className="max-w-lg mx-auto font-serif text-zinc-800 leading-relaxed">
            {/* Title page simulation */}
            <div className="text-center mb-12">
              <h1 className="text-3xl font-bold mb-4 text-zinc-900">{activeBook?.title || 'Untitled'}</h1>
              {activeBook?.penName && <p className="text-lg text-zinc-600 italic">by {activeBook.penName}</p>}
              {activeBook?.genre && <p className="text-sm text-zinc-400 mt-2">{activeBook.genre}</p>}
            </div>

            {/* Chapters */}
            {chapters.map((chapter) => (
              <div key={chapter.id} className="mb-10">
                <h2 className="text-2xl font-bold text-zinc-900 mb-4 border-b border-zinc-200 pb-2">
                  {chapter.title}
                </h2>
                {chapter.synopsis && (
                  <p className="text-sm text-zinc-400 italic mb-4">{chapter.synopsis}</p>
                )}
                {chapter.scenes.map((scene) => (
                  <div key={scene.id} className="mb-6">
                    {chapter.scenes.length > 1 && (
                      <h3 className="text-lg font-semibold text-zinc-700 mb-2">{scene.title}</h3>
                    )}
                    <div className="text-base leading-7 text-zinc-700">
                      {renderInlineImages(scene.content)}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {chapters.length === 0 && (
              <p className="text-center text-zinc-400 mt-20">No content yet. Write some scenes to preview them here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
