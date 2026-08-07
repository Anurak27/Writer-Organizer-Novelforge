'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import type { ChatMessage } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MessageSquare, Trash2, Send } from 'lucide-react';
import { getActiveAiConfig, callLocalAI } from '@/lib/ai-client';

const SUGGESTION_CHIPS = [
  'Help me develop my protagonist',
  'What plot holes should I address?',
  'Suggest a scene for chapter 2',
  'Help me with character dialogue',
] as const;

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2 px-4 pb-2">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg rounded-tl-sm px-3 py-2.5">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

export function ChatPanel() {
  const token = useAppStore((s) => s.token);
  const activeBookId = useAppStore((s) => s.activeBookId);
  const chatMessages = useAppStore((s) => s.chatMessages);
  const setChatMessages = useAppStore((s) => s.setChatMessages);
  const addChatMessage = useAppStore((s) => s.addChatMessage);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  // Fetch chat history on mount and when bookId changes
  useEffect(() => {
    if (!token || !activeBookId) return;

    let cancelled = false;

    async function fetchHistory() {
      try {
        const res = await fetch(
          `/api/chat?bookId=${activeBookId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const data = await res.json();
        // GET /api/chat returns an array directly
        if (!cancelled && Array.isArray(data)) {
          setChatMessages(data);
        }
      } catch {
        // Silently fail on network errors
      }
    }

    fetchHistory();
    setHasMounted(true);

    return () => { cancelled = true; };
  }, [token, activeBookId, setChatMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (!hasMounted) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length, hasMounted, isLoading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !token || isLoading) return;

      setInput('');
      setIsLoading(true);

      try {
        // Check if we should use client-side local AI
        const localConfig = await getActiveAiConfig(token);

        if (localConfig) {
          // Client-side local AI (Ollama/custom)
          // Save user message locally first
          const userMsg: ChatMessage = {
            id: `temp-user-${Date.now()}`,
            bookId: activeBookId,
            role: 'user',
            content: trimmed,
            createdAt: new Date().toISOString(),
          };
          addChatMessage(userMsg);

          const systemPrompt = 'You are a creative writing sparring partner helping a novelist brainstorm ideas, fix plot holes, develop characters, and explore story directions. Be conversational, insightful, and ask follow-up questions. Keep responses concise (2-4 paragraphs max).';

          const history = chatMessages
            .filter((m) => m.role !== 'system')
            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

          const reply = await callLocalAI(localConfig, systemPrompt, trimmed, history);

          const assistantMsg: ChatMessage = {
            id: `temp-asst-${Date.now()}`,
            bookId: activeBookId,
            role: 'assistant',
            content: reply,
            createdAt: new Date().toISOString(),
          };
          addChatMessage(assistantMsg);
        } else {
          // Server-side AI (cloud providers)
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: 'send',
              content: trimmed,
              bookId: activeBookId,
            }),
          });

          const data = await res.json();

          if (res.ok) {
            // POST returns { userMessage, assistantMessage }
            if (data.userMessage && data.assistantMessage) {
              setChatMessages([...chatMessages, data.userMessage, data.assistantMessage]);
            }
          }
        }
      } catch {
        // Silently fail on network errors
      } finally {
        setIsLoading(false);
      }
    },
    [token, activeBookId, isLoading, setChatMessages, addChatMessage, chatMessages]
  );

  const handleClear = useCallback(async () => {
    if (!token || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'clear', bookId: activeBookId }),
      });

      if (res.ok) {
        setChatMessages([]);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [token, activeBookId, isLoading, setChatMessages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const bookMessages = chatMessages.filter(
    (m) => m.bookId === activeBookId || m.bookId === null
  );

  const isEmpty = bookMessages.length === 0 && !isLoading;

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <div className="px-4 py-3 border-b border-zinc-800/50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-medium text-zinc-300">AI Chat</h3>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-300" disabled={isLoading}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-zinc-900 border-zinc-800">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-zinc-100">Clear chat history?</AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400">
                  This will permanently delete all messages in this conversation.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClear} className="bg-red-600 hover:bg-red-500 text-white">Clear</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <ScrollArea className="flex-1" ref={scrollViewportRef}>
        <div className="flex flex-col min-h-full">
          {isEmpty ? (
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 gap-4">
              <MessageSquare className="w-10 h-10 text-zinc-700" />
              <p className="text-sm text-zinc-500 text-center">Start a conversation to brainstorm your story</p>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                {SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => sendMessage(chip)}
                    className="text-left text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 hover:bg-zinc-800 hover:text-zinc-300 hover:border-zinc-700 transition-colors cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-3 px-4 space-y-3">
              {bookMessages.map((msg: ChatMessage) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 border ${
                    msg.role === 'user'
                      ? 'bg-amber-600/20 border-amber-600/30 text-zinc-200 rounded-tr-sm'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 rounded-tl-sm'
                  }`}>
                    <p className="text-sm font-sans whitespace-pre-wrap leading-relaxed break-words">{msg.content}</p>
                    <p className="text-[10px] text-zinc-600 mt-1">{formatTime(msg.createdAt)}</p>
                  </div>
                </div>
              ))}
              {isLoading && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="px-4 py-3 border-t border-zinc-800/50 shrink-0">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your story..."
            disabled={isLoading}
            className="bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 text-sm font-sans h-9 focus-visible:border-amber-600/50 focus-visible:ring-amber-600/20"
          />
          <Button
            size="icon"
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="h-9 w-9 bg-amber-600 hover:bg-amber-500 text-white shrink-0 disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
