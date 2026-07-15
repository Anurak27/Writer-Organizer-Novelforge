'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore, AiConfig } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Key, Save, Trash2, CheckCircle, AlertCircle, BookOpen, LogOut, ArrowLeft } from 'lucide-react';

export function SettingsScreen() {
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const token = useAppStore((s) => s.token);
  const setToken = useAppStore((s) => s.setToken);
  const setView = useAppStore((s) => s.setView);

  const fetchConfigs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/ai/config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConfigs(data);
        const active = data.find((c: AiConfig) => c.isActive);
        if (active) {
          setProvider(active.provider);
          setModelName(active.modelName || '');
        }
      }
    } catch {
      // silent
    }
  }, [token]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleSave = async () => {
    if (!apiKey.trim() || !token) return;
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      const res = await fetch('/api/ai/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          modelName: modelName.trim() || null,
        }),
      });
      if (res.ok) {
        setSuccess(`${provider} API key saved successfully.`);
        setApiKey('');
        fetchConfigs();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (prov: string) => {
    if (!confirm(`Remove ${prov} API key?`)) return;
    try {
      await fetch('/api/ai/config', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ provider: prov }),
      });
      fetchConfigs();
    } catch {
      // silent
    }
  };

  const handleLogout = () => {
    setToken(null);
    setView('auth');
  };

  const providerLabels: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic (Claude)',
    openrouter: 'OpenRouter',
  };

  const defaultModels: Record<string, string> = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-sonnet-4-20250514',
    openrouter: 'openai/gpt-4o-mini',
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('dashboard')}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-lg font-bold text-zinc-100">Settings</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-zinc-500 hover:text-red-400"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Lock
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* AI Provider Configuration */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-zinc-100">AI Provider Configuration</h2>
          </div>
          <p className="text-sm text-zinc-500 mb-6">
            Add your own API key to enable AI writing features. Your key is stored locally in the database and sent directly to the provider — never shared with any third party.
          </p>

          {/* Saved Configs */}
          {configs.length > 0 && (
            <div className="space-y-2 mb-6">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {config.isActive ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-zinc-700" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-zinc-200">
                        {providerLabels[config.provider] || config.provider}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {config.modelName || 'Default model'}
                        {config.isActive && ' (Active)'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-zinc-500 hover:text-red-400"
                    onClick={() => handleDelete(config.provider)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add/Edit Config */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Provider</label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">API Key</label>
              <Input
                type="password"
                placeholder={configs.find((c) => c.provider === provider) ? 'Enter new key to replace...' : 'sk-... or key-...'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 font-mono"
              />
              <p className="text-xs text-zinc-600 mt-1">
                {provider === 'openai' && 'Get your key from platform.openai.com'}
                {provider === 'anthropic' && 'Get your key from console.anthropic.com'}
                {provider === 'openrouter' && 'Get your key from openrouter.ai/keys'}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                Model Name{' '}
                <span className="text-zinc-600 font-normal">(optional)</span>
              </label>
              <Input
                placeholder={defaultModels[provider] || 'Default model'}
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 font-mono"
              />
            </div>

            {success && (
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                {success}
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {saving ? 'Saving...' : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save {providerLabels[provider]} Key
                </>
              )}
            </Button>
          </div>
        </section>

        <Separator className="bg-zinc-800" />

        {/* About */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-5 h-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-100">About</h2>
          </div>
          <p className="text-sm text-zinc-500 leading-relaxed">
            NovelForge is a personal, single-user creative writing application designed for novelists.
            Your data is stored securely and accessible only with your master password.
            The AI features use your own API keys and your data is never sent to any third-party service other than your chosen AI provider.
          </p>
        </section>
      </main>
    </div>
  );
}