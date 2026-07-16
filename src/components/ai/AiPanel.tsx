'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Copy, Replace, X, Wand2, Expand, Shrink, RefreshCw, Loader2, Play, FileText } from 'lucide-react';
import { extractMentions } from '@/components/editor/MentionDropdown';

export function AiPanel() {
  const token = useAppStore((s) => s.token);
  const activeScene = useAppStore((s) => s.activeScene);
  const activeBookId = useAppStore((s) => s.activeBookId);
  const aiGeneratedText = useAppStore((s) => s.aiGeneratedText);
  const setAiGeneratedText = useAppStore((s) => s.setAiGeneratedText);
  const aiLoading = useAppStore((s) => s.aiLoading);
  const setAiLoading = useAppStore((s) => s.setAiLoading);

  const [beats, setBeats] = useState('');
  const [aiError, setAiError] = useState('');

  const generate = useCallback(
    async (action: string, text?: string) => {
      if (!token) return;
      setAiLoading(true);
      setAiError('');
      setAiGeneratedText(null);

      try {
        const mentionedNames = activeScene?.content
          ? extractMentions(activeScene.content)
          : [];

        const body: Record<string, unknown> = {
          action,
          text: text || activeScene?.content || '',
          sceneContent: activeScene?.content || '',
          mentionedNames,
          bookId: activeBookId,
          sceneId: activeScene?.id,
        };

        if (action === 'generate_scene') {
          body.beats = beats;
        }

        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok) {
          setAiError(data.error || 'AI generation failed');
          return;
        }

        setAiGeneratedText(data.result);
      } catch {
        setAiError('Network error. Please check your API key and try again.');
      } finally {
        setAiLoading(false);
      }
    },
    [token, activeScene, activeBookId, beats, setAiLoading, setAiGeneratedText]
  );

  const copyToClipboard = () => {
    if (aiGeneratedText) {
      navigator.clipboard.writeText(aiGeneratedText);
    }
  };

  const insertIntoEditor = () => {
    if (!aiGeneratedText) return;
    // Dispatch a custom event that the editor can listen to
    window.dispatchEvent(
      new CustomEvent('ai-insert-text', { detail: aiGeneratedText })
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/50 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-medium text-zinc-300">AI Writing Buddy</h3>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Inline Actions */}
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              Selected Text Actions
            </p>
            <p className="text-xs text-zinc-600 mb-3">
              Select text in the editor, then choose an action:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 h-auto py-2"
                onClick={() => generate('expand')}
                disabled={aiLoading}
              >
                <Expand className="w-3.5 h-3.5 mr-1" />
                Expand
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 h-auto py-2"
                onClick={() => generate('rewrite')}
                disabled={aiLoading}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Rewrite
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 h-auto py-2"
                onClick={() => generate('shorten')}
                disabled={aiLoading}
              >
                <Shrink className="w-3.5 h-3.5 mr-1" />
                Shorten
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-800/50 text-amber-400 hover:bg-amber-900/30 hover:text-amber-300 h-auto py-2 border-dashed"
                onClick={() => generate('continue')}
                disabled={aiLoading}
              >
                <Play className="w-3.5 h-3.5 mr-1" />
                Continue
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 text-xs mt-1"
              onClick={() => generate('summarize')}
              disabled={aiLoading || !activeScene?.content?.trim()}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Summarize Scene → Notes
            </Button>
          </div>

          <div className="border-t border-zinc-800/50" />

          {/* Scene Beats Generator */}
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              Scene Generator
            </p>
            <p className="text-xs text-zinc-600 mb-3">
              Describe scene beats and let AI draft a rough version:
            </p>
            <Textarea
              placeholder={`E.g., "John walks into the bar. He meets Sarah. They argue about the map."`}
              value={beats}
              onChange={(e) => setBeats(e.target.value)}
              className="bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 text-sm min-h-[100px] resize-none"
            />
            <Button
              className="w-full mt-2 bg-amber-600 hover:bg-amber-500 text-white"
              size="sm"
              onClick={() => generate('generate_scene')}
              disabled={aiLoading || !beats.trim()}
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Scene
                </>
              )}
            </Button>
          </div>

          {/* Error */}
          {aiError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{aiError}</p>
            </div>
          )}

          {/* Generated Text */}
          {aiGeneratedText && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Generated Result
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
                    onClick={copyToClipboard}
                    title="Copy to clipboard"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-amber-500 hover:text-amber-400"
                    onClick={insertIntoEditor}
                    title="Append to scene"
                  >
                    <Replace className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
                    onClick={() => setAiGeneratedText(null)}
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-lg max-h-96 overflow-y-auto">
                <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed font-serif">
                  {aiGeneratedText}
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}