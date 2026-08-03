'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, Lock, Eye, EyeOff } from 'lucide-react';

export function AuthScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordSet, setPasswordSet] = useState<boolean | null>(null);
  const setToken = useAppStore((s) => s.setToken);
  const setView = useAppStore((s) => s.setView);

  // Check if password is already set
  useState(() => {
    fetch('/api/auth')
      .then((r) => r.json())
      .then((data) => setPasswordSet(data.passwordSet))
      .catch(() => setPasswordSet(false));
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const action = passwordSet ? 'login' : 'setup';
      const body: Record<string, string> = { action, password };

      if (!passwordSet && password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.details || data.error || 'Authentication failed');
        setLoading(false);
        return;
      }

      setToken(data.token);
      setView('dashboard');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 mb-4">
            <BookOpen className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">NovelForge</h1>
          <p className="text-zinc-500 text-sm mt-1">Your personal writing sanctuary</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder={passwordSet ? 'Enter your password' : 'Create a master password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 h-12"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {!passwordSet && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 h-12"
              />
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full h-12 bg-amber-600 hover:bg-amber-500 text-white font-medium"
          >
            {loading ? 'Please wait...' : passwordSet ? 'Unlock' : 'Set Password & Enter'}
          </Button>
        </form>

        <p className="text-zinc-600 text-xs text-center mt-6">
          {passwordSet ? 'This is your private workspace.' : 'Choose a password to secure your workspace.'}
        </p>
      </div>
    </div>
  );
}