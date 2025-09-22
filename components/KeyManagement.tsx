'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Eye, EyeOff, RefreshCw, ExternalLink } from 'lucide-react';

interface LiteLLMKey {
  id: string;
  key: string; // The actual API key value
  key_alias: string;
  is_active: boolean;
  created_at: string;
  credit_balance: number;
  needs_payment: boolean;
}

interface KeyData {
  keys: LiteLLMKey[];
  litellm_configured: boolean;
  litellm_base_url: string;
}

interface KeyManagementProps {
  showHeader?: boolean;
  compact?: boolean;
  onKeyCreated?: () => void;
}

export default function KeyManagement({
  showHeader = true,
  compact = false,
  onKeyCreated
}: KeyManagementProps) {
  const [keyData, setKeyData] = useState<KeyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const fetchKeys = async () => {
    try {
      const response = await fetch('/api/keys/manage');
      if (response.ok) {
        const data = await response.json();
        setKeyData(data);
      }
    } catch (error) {
      console.error('Failed to fetch keys:', error);
    }
  };

  const createKey = async () => {
    setCreating(true);
    try {
      const response = await fetch('/api/keys/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' })
      });

      if (response.ok) {
        await fetchKeys();
        onKeyCreated?.();
      } else {
        const error = await response.json();
        alert(`Failed to create key: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to create key:', error);
      alert('Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const sendTestRequest = async () => {
    try {
      const res = await fetch('/api/diagnostics/proxy-test', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(`Test failed: ${data.error || 'Unknown error'}`);
        return;
      }
      alert(`Test ok: model=${data.model} tokens=${data.tokens?.total || 0} cost_cents=${data.cost_cents ?? 'n/a'}`);
    } catch (e) {
      console.error('Test request error:', e);
      alert('Test request failed');
    }
  };

  const consolidateKeys = async () => {
    if (!confirm('Consolidate to a single active key? This will deactivate duplicates.')) return;
    try {
      const res = await fetch('/api/keys/consolidate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(`Consolidation failed: ${data.error || 'Unknown error'}`);
        return;
      }
      alert(`Consolidated. Active key: ${data.active_key_mask}`);
      await fetchKeys();
    } catch (e) {
      console.error('Consolidate error:', e);
      alert('Consolidation failed');
    }
  };

  const syncSpend = async () => {
    try {
      const res = await fetch('/api/keys/sync-spend', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(`Sync failed: ${data.error || 'Unknown error'}`);
        return;
      }
      alert('Spend synced successfully.');
      await fetchKeys();
    } catch (e) {
      console.error('Sync spend error:', e);
      alert('Sync failed');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here in the future
      console.log('API key copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchKeys();
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-sm">Loading keys...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">API Key Management</h2>
            <p className="text-sm text-muted-foreground">
              Manage your LiteLLM API keys for direct access to AI models
            </p>
          </div>
          <Button
            onClick={createKey}
            disabled={creating || !keyData?.litellm_configured}
            size="sm"
          >
            {creating ? (
              <>
                <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Key'
            )}
          </Button>
        </div>
      )}

      {!keyData?.litellm_configured && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800">LiteLLM Not Configured</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-700">
              LiteLLM is not configured. Please add the required environment variables to enable key management.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Credit balance is now displayed by the unified card on the Billing page */}

      {!compact && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your API Keys</CardTitle>
            <CardDescription>
              Use these keys to make direct requests to LiteLLM.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {keyData?.keys.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">No API keys found.</p>
                <Button
                  onClick={createKey}
                  disabled={creating || !keyData?.litellm_configured}
                  size="sm"
                >
                  Create Your First Key
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {keyData?.keys.map((key) => (
                  <div key={key.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-medium">{key.key_alias}</h3>
                          <Badge variant={key.is_active ? 'default' : 'secondary'} className="text-xs">
                            {key.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {key.needs_payment ? 'Payment Required' : 'Active'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`key-${key.id}`} className="text-xs">API Key</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          id={`key-${key.id}`}
                          type={showKeys[key.id] ? 'text' : 'password'}
                          value={key.key}
                          readOnly
                          className="font-mono text-xs h-8"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleKeyVisibility(key.id)}
                          className="h-8 w-8 p-0"
                        >
                          {showKeys[key.id] ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(key.key)}
                          className="h-8 w-8 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!compact && showHeader && keyData?.litellm_configured && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Proxy Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">LiteLLM Proxy URL</h4>
              <div className="flex items-center space-x-2">
                <Input
                  value={keyData?.litellm_base_url || ''}
                  readOnly
                  className="font-mono text-xs h-8"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => keyData?.litellm_base_url && copyToClipboard(keyData.litellm_base_url)}
                  className="h-8 w-8 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => keyData?.litellm_base_url && window.open(keyData.litellm_base_url, '_blank')}
                  className="h-8 w-8 p-0"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={sendTestRequest}>
                Send Test Request
              </Button>
              <Button variant="outline" onClick={consolidateKeys}>
                Consolidate Keys
              </Button>
              <Button variant="outline" onClick={syncSpend}>
                Sync Spend Now
              </Button>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Helpful Links</h4>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => window.open('https://docs.bastco.org', '_blank')}>
                  Docs
                </Button>
                <Button variant="secondary" onClick={() => window.open('https://blog.bastco.org', '_blank')}>
                  Blog
                </Button>
              </div>
              <div className="hidden bg-gray-100 p-2 rounded text-xs font-mono mb-2">
                <div>curl {keyData.litellm_base_url}/v1/chat/completions \</div>
                <div>  -H "Authorization: Bearer YOUR_API_KEY" \</div>
                <div>  -H "Content-Type: application/json" \</div>
                <div>  -d {`{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "Hello!"}]}`}'</div>
              </div>
              <p className="hidden text-xs text-muted-foreground">
                Replace <code className="bg-gray-50 px-1 rounded">YOUR_API_KEY</code> with your actual API key above.
                All requests are automatically tracked and billed.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
