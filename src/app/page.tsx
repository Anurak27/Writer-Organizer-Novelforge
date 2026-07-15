'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Bookshelf } from '@/components/dashboard/Bookshelf';
import { EditorView } from '@/components/editor/EditorView';
import { SettingsScreen } from '@/components/ai/SettingsScreen';

export default function Home() {
  const view = useAppStore((s) => s.view);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const token = useAppStore((s) => s.token);
  const setToken = useAppStore((s) => s.setToken);
  const setView = useAppStore((s) => s.setView);

  // Restore session from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('nf_token');
    if (savedToken) {
      // Verify token is still valid
      fetch('/api/auth', {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((r) => {
          if (r.ok) {
            setToken(savedToken);
            setView('dashboard');
          } else {
            localStorage.removeItem('nf_token');
          }
        })
        .catch(() => {
          localStorage.removeItem('nf_token');
        });
    }
  }, [setToken, setView]);

  // Persist token to localStorage
  useEffect(() => {
    if (token) {
      localStorage.setItem('nf_token', token);
    } else {
      localStorage.removeItem('nf_token');
    }
  }, [token]);

  if (!isAuthenticated || view === 'auth') {
    return <AuthScreen />;
  }

  if (view === 'dashboard') {
    return <Bookshelf />;
  }

  if (view === 'settings') {
    return <SettingsScreen />;
  }

  if (view === 'editor') {
    return <EditorView />;
  }

  return <AuthScreen />;
}