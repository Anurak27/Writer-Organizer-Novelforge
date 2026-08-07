'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Key, Save, Trash2, CheckCircle, AlertCircle, BookOpen, LogOut, ArrowLeft, Star, Zap, Shield, Loader2, Wifi, WifiOff } from 'lucide-react';

const PROVIDERS: Record<string, { label: string; defaultModel: string; hint: string; needsBaseUrl: boolean; needsApiKey?: boolean; defaultBaseUrl?: string }> = {
  openrouter:  { label: 'OpenRouter',       defaultModel: 'openai/gpt-4o-mini',                  hint: 'openrouter.ai/keys',                   needsBaseUrl: false },
  groq:        { label: 'Groq',             defaultModel: 'llama-3.3-70b-versatile',               hint: 'console.groq.com/keys',                needsBaseUrl: false },
  cerebras:    { label: 'Cerebras',         defaultModel: 'llama-4-scout-17b-16e-instruct',      hint: 'cloud.cerebras.ai',                    needsBaseUrl: false },
  nararouter:  { label: 'NaraRouter',       defaultModel: 'openai/gpt-4o-mini',                  hint: 'router.bynara.id',                     needsBaseUrl: true },
  google:      { label: 'Google AI Studio', defaultModel: 'gemini-2.0-flash',                     hint: 'aistudio.google.com/apikey',            needsBaseUrl: false },
  openai:      { label: 'OpenAI',           defaultModel: 'gpt-4o-mini',                          hint: 'platform.openai.com',                   needsBaseUrl: false },
  anthropic:   { label: 'Anthropic (Claude)', defaultModel: 'claude-sonnet-4-20250514',         hint: 'console.anthropic.com',                 needsBaseUrl: false },
  ollama:      { label: 'Ollama (Local AI)', defaultModel: 'llama3.1',                              hint: 'ollama.com — install & run Ollama locally, then pull a model (e.g. ollama pull llama3.1)', defaultBaseUrl: 'http://localhost:11434/v1/chat/completions', needsBaseUrl: true, needsApiKey: false },
};

export function SettingsScreen() {
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [provider, setProvider] = useState('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [activating, setActivating] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; models?: string[] } | null>(null);

  // Change password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const pwSectionRef = useRef<HTMLDivElement>(null);

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
      }
    } catch {
      // silent
    }
  }, [token]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // Scroll to password section if navigated via Password button
  useEffect(() => {
    if (window.location.hash === '#password' && pwSectionRef.current) {
      setTimeout(() => pwSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, []);

  // When provider changes, pre-fill default values
  const handleProviderChange = (p: string) => {
    setProvider(p);
    setModelName('');
    setBaseUrl('');
    setApiKey('');
    const existing = configs.find((c) => c.provider === p);
    if (existing) {
      setModelName(existing.modelName || '');
      setBaseUrl(existing.baseUrl || '');
    } else {
      // Pre-fill default base URL for providers that need it
      if (PROVIDERS[p]?.needsBaseUrl && PROVIDERS[p]?.defaultBaseUrl) {
        setBaseUrl(PROVIDERS[p].defaultBaseUrl!);
      }
    }
  };

  const handleSave = async () => {
    const provDef = PROVIDERS[provider];
    // Ollama doesn't need an API key, just needs baseUrl
    if (!provDef?.needsApiKey && !apiKey.trim() && !baseUrl.trim()) {
      setError('Ollama needs a base URL. Default: http://localhost:11434');
      return;
    }
    if (provDef?.needsApiKey !== false && !apiKey.trim()) return;
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      const body: Record<string, unknown> = {
        provider,
        apiKey: provDef?.needsApiKey === false ? 'no-key-needed' : apiKey.trim(),
        modelName: modelName.trim() || null,
      };
      // Only send baseUrl if the provider needs it or if user provided one
      if (provDef?.needsBaseUrl || baseUrl.trim()) {
        body.baseUrl = baseUrl.trim() || null;
      }
      const res = await fetch('/api/ai/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSuccess(`${provDef?.label || provider} saved successfully.`);
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

  const handleTest = async () => {
    const provDef = PROVIDERS[provider];
    if (provDef?.needsApiKey !== false && !apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      const body: Record<string, unknown> = {
        provider,
        apiKey: provDef?.needsApiKey === false ? 'no-key-needed' : apiKey.trim(),
        modelName: modelName.trim() || null,
        baseUrl: (provDef?.needsBaseUrl ? (baseUrl.trim() || provDef.defaultBaseUrl) : baseUrl.trim()) || null,
      };
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setTestResult({
        success: data.success || false,
        message: data.error || data.message || 'Test completed',
        models: data.models || undefined,
      });
      // If Ollama test succeeded and found models, auto-fill the first one
      if (data.success && data.models?.length > 0 && !modelName.trim()) {
        // Extract just the model name (e.g., "llama3.1:latest" -> "llama3.1")
        setModelName(data.models[0].split(':').shift() || data.models[0]);
      }
    } catch {
      setTestResult({ success: false, message: 'Network error — could not reach the test endpoint.' });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async (prov: string) => {
    const label = PROVIDERS[prov]?.label || prov;
    if (!confirm(`Remove ${label} API key?`)) return;
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

  const handleSetActive = async (prov: string) => {
    if (activating) return;
    setActivating(prov);
    try {
      // Deactivate all, then activate the selected one
      const target = configs.find((c) => c.provider === prov);
      if (!target) return;
      await fetch('/api/ai/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: prov,
          apiKey: '__keep_existing__',
          isActive: true,
        }),
      });
      // Deactivate others
      for (const c of configs) {
        if (c.provider !== prov && c.isActive) {
          await fetch('/api/ai/config', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              provider: c.provider,
              apiKey: '__keep_existing__',
              isActive: false,
            }),
          });
        }
      }
      fetchConfigs();
    } catch {
      // silent
    } finally {
      setActivating(null);
    }
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      setPwMsg('Error: New passwords do not match.');
      return;
    }
    if (newPw.length < 4) {
      setPwMsg('Error: New password must be at least 4 characters.');
      return;
    }
    setChangingPw(true);
    setPwMsg('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_password', password: currentPw, currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwMsg(data.message || 'Password changed successfully.');
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
        // Update token if server returned a new one
        if (data.token) setToken(data.token);
      } else {
        setPwMsg('Error: ' + (data.error || 'Failed to change password.'));
      }
    } catch {
      setPwMsg('Error: Network error.');
    } finally {
      setChangingPw(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setView('auth');
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
            <Zap className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-zinc-100">AI Provider Configuration</h2>
          </div>
          <p className="text-sm text-zinc-500 mb-6">
            Add your own API keys to enable AI writing features. Keys are stored locally and sent directly to the provider — never shared with any third party. Click the star to set your active provider.
          </p>

          {/* Saved Configs */}
          {configs.length > 0 && (
            <div className="space-y-2 mb-6">
              {configs.map((config) => {
                const provDef = PROVIDERS[config.provider];
                return (
                  <div
                    key={config.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      config.isActive
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleSetActive(config.provider)}
                        className="text-zinc-600 hover:text-amber-400 transition-colors"
                        title={config.isActive ? 'Active provider (click to change)' : 'Click to set as active'}
                      >
                        {config.isActive ? (
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        ) : (
                          <Star className="w-4 h-4" />
                        )}
                      </button>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">
                          {provDef?.label || config.provider}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {config.modelName || provDef?.defaultModel || 'Default model'}
                          {config.isActive && (
                            <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400">
                              Active
                            </Badge>
                          )}
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
                );
              })}
            </div>
          )}

          {/* Add/Edit Config */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Provider</label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {Object.entries(PROVIDERS).map(([key, def]) => (
                    <SelectItem key={key} value={key}>{def.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                API Key{PROVIDERS[provider]?.needsApiKey === false && ' (optional for this provider)'}
              </label>
              <Input
                type="password"
                placeholder={
                  PROVIDERS[provider]?.needsApiKey === false
                    ? 'Not needed for local AI'
                    : configs.find((c) => c.provider === provider)
                      ? 'Enter new key to replace...'
                      : 'Paste your API key...'
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm"
              />
              <p className="text-xs text-zinc-600 mt-1">
                {PROVIDERS[provider]?.needsApiKey === false ? PROVIDERS[provider]?.hint : `Get your key from ${PROVIDERS[provider]?.hint}`}
              </p>
            </div>

            {PROVIDERS[provider]?.needsBaseUrl && (
              <div>
                <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                  Base URL
                </label>
                <Input
                  placeholder={PROVIDERS[provider]?.defaultModel || 'http://localhost:11434'}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                Model Name{' '}
                <span className="text-zinc-600 font-normal">(optional — overrides default)</span>
              </label>
              <Input
                placeholder={PROVIDERS[provider]?.defaultModel || 'Default model'}
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm"
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

            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={saving || (PROVIDERS[provider]?.needsApiKey !== false && !apiKey.trim())}
                className="bg-amber-600 hover:bg-amber-500 text-white"
              >
                {saving ? 'Saving...' : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save {PROVIDERS[provider]?.label || provider}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testing || (PROVIDERS[provider]?.needsApiKey !== false && !apiKey.trim())}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                {testing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing...</>
                ) : (
                  <><Wifi className="w-4 h-4 mr-2" />Test Connection</>
                )}
              </Button>
            </div>
            {testResult && (
              <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${
                testResult.success
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {testResult.success
                  ? <Wifi className="w-4 h-4 mt-0.5 shrink-0" />
                  : <WifiOff className="w-4 h-4 mt-0.5 shrink-0" />
                }
                <div>
                  <p>{testResult.message}</p>
                  {testResult.success && testResult.models && (
                    <p className="text-xs mt-1 opacity-75">Available: {testResult.models.join(', ')}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <Separator className="bg-zinc-800" />

        {/* Change Password */}
        <section ref={pwSectionRef} id="change-password">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-zinc-100">Change Password</h2>
          </div>
          <p className="text-sm text-zinc-500 mb-4">
            Update your master password. You will need to enter your current password to confirm the change.
          </p>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Current Password</label>
              <Input
                type="password"
                placeholder="Enter current password"
                value={currentPw}
                onChange={(e) => { setCurrentPw(e.target.value); setPwMsg(''); }}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">New Password</label>
              <Input
                type="password"
                placeholder="Enter new password (min 4 chars)"
                value={newPw}
                onChange={(e) => { setNewPw(e.target.value); setPwMsg(''); }}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Confirm New Password</label>
              <Input
                type="password"
                placeholder="Repeat new password"
                value={confirmPw}
                onChange={(e) => { setConfirmPw(e.target.value); setPwMsg(''); }}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            {pwMsg && (
              <div className={`flex items-center gap-2 text-sm ${pwMsg.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                {pwMsg.startsWith('Error') ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                {pwMsg}
              </div>
            )}
            <Button
              onClick={handleChangePassword}
              disabled={changingPw || !currentPw || !newPw || !confirmPw}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {changingPw ? 'Changing...' : 'Update Password'}
            </Button>
          </div>
        </section>

        <Separator className="bg-zinc-800" />

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