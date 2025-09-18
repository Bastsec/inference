'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Eye, EyeOff, RefreshCw, ExternalLink, CreditCard, AlertTriangle } from 'lucide-react';

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

      {/* Credit Balance and Payment Prompt */}
      {keyData?.keys && keyData.keys.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {keyData.keys.map((key) => (
            <Card key={`balance-${key.id}`} className={key.needs_payment ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
              <CardHeader className="pb-2">
                <CardTitle className={`flex items-center space-x-2 text-sm ${key.needs_payment ? 'text-red-800' : 'text-green-800'}`}>
                  {key.needs_payment ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  <span>Credit Balance</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium">Available Credits:</span>
                    <span className={`text-sm font-bold ${key.needs_payment ? 'text-red-600' : 'text-green-600'}`}>
                      ${key.credit_balance.toFixed(2)}
                    </span>
                  </div>

                  {key.needs_payment ? (
                    <div className="space-y-1">
                      <p className="text-xs text-red-700">
                        Credits exhausted. Add more to continue.
                      </p>
                      <Button
                        size="sm"
                        className="w-full bg-red-600 hover:bg-red-700"
                        onClick={() => window.location.href = '/pricing'}
                      >
                        <CreditCard className="mr-1 h-3 w-3" />
                        Add Credits
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs text-green-700">
                        API key ready to use.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-green-300 text-green-700 hover:bg-green-100"
                        onClick={() => window.location.href = '/pricing'}
                      >
                        <CreditCard className="mr-1 h-3 w-3" />
                        Add More
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
            <CardTitle className="text-lg">Usage Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="text-sm font-medium mb-2">LiteLLM Base URL</h4>
              <div className="flex items-center space-x-2">
                <Input
                  value={keyData.litellm_base_url}
                  readOnly
                  className="font-mono text-xs h-8"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(keyData.litellm_base_url)}
                  className="h-8 w-8 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(keyData.litellm_base_url, '_blank')}
                  className="h-8 w-8 p-0"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">How to Use Your API Key</h4>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <strong>Important:</strong> Use this API key with any OpenAI-compatible client or library.
                    All usage will be automatically tracked and charged against your credit balance.
                  </div>
                </div>
              </div>
              <div className="bg-gray-100 p-2 rounded text-xs font-mono mb-2">
                <div>curl {keyData.litellm_base_url}/v1/chat/completions \</div>
                <div>  -H "Authorization: Bearer YOUR_API_KEY" \</div>
                <div>  -H "Content-Type: application/json" \</div>
                <div>  -d {`{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "Hello!"}]}`}'</div>
              </div>
              <p className="text-xs text-muted-foreground">
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
