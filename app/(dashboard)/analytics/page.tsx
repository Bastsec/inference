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
  litellm_key: string;
  key_alias: string;
  max_budget: number;
  budget_duration: string;
  is_active: boolean;
  created_at: string;
  expires_at?: string;
  credit_balance: number;
  needs_payment: boolean;
}

interface KeyData {
  keys: LiteLLMKey[];
  litellm_configured: boolean;
  litellm_base_url: string;
}

export default function KeyManagementPage() {
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
      // Could add a toast notification here
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
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading keys...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">API Key Management</h1>
          <p className="text-muted-foreground">
            Manage your LiteLLM API keys for direct access to AI models
          </p>
        </div>
        <Button onClick={createKey} disabled={creating || !keyData?.litellm_configured}>
          {creating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create New Key'
          )}
        </Button>
      </div>

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
        <div className="grid gap-4 md:grid-cols-2">
          {keyData.keys.map((key) => (
            <Card key={`balance-${key.id}`} className={key.needs_payment ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
              <CardHeader>
                <CardTitle className={`flex items-center space-x-2 ${key.needs_payment ? 'text-red-800' : 'text-green-800'}`}>
                  {key.needs_payment ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <CreditCard className="h-5 w-5" />
                  )}
                  <span>Credit Balance</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Available Credits:</span>
                    <span className={`text-lg font-bold ${key.needs_payment ? 'text-red-600' : 'text-green-600'}`}>
                      ${key.credit_balance.toFixed(2)}
                    </span>
                  </div>
                  
                  {key.needs_payment ? (
                    <div className="space-y-2">
                      <p className="text-sm text-red-700">
                        Your credits are exhausted. Add more credits to continue using the API.
                      </p>
                      <Button 
                        className="w-full bg-red-600 hover:bg-red-700" 
                        onClick={() => window.location.href = '/pricing'}
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        Add Credits
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-green-700">
                        You have sufficient credits. Your API key is ready to use.
                      </p>
                      <Button 
                        variant="outline" 
                        className="w-full border-green-300 text-green-700 hover:bg-green-100"
                        onClick={() => window.location.href = '/pricing'}
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        Add More Credits
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Your API Keys</CardTitle>
            <CardDescription>
              Use these keys to make direct requests to LiteLLM. Copy and use them in your applications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {keyData?.keys.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No API keys found.</p>
                <Button onClick={createKey} disabled={creating || !keyData?.litellm_configured}>
                  Create Your First Key
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {keyData?.keys.map((key) => (
                  <div key={key.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">{key.key_alias}</h3>
                          <Badge variant={key.is_active ? 'default' : 'secondary'}>
                            {key.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Budget: ${key.max_budget} • Duration: {key.budget_duration} • Credits: ${key.credit_balance.toFixed(2)}
                        </p>
                        {key.expires_at && (
                          <p className="text-sm text-muted-foreground">
                            Expires: {new Date(key.expires_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`key-${key.id}`}>API Key</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          id={`key-${key.id}`}
                          type={showKeys[key.id] ? 'text' : 'password'}
                          value={key.litellm_key}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleKeyVisibility(key.id)}
                        >
                          {showKeys[key.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(key.litellm_key)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {keyData?.litellm_configured && (
          <Card>
            <CardHeader>
              <CardTitle>Usage Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">LiteLLM Base URL</h4>
                <div className="flex items-center space-x-2">
                  <Input
                    value={keyData.litellm_base_url}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(keyData.litellm_base_url)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(keyData.litellm_base_url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Example Usage</h4>
                <div className="bg-gray-100 p-3 rounded text-sm font-mono">
                  <div>curl {keyData.litellm_base_url}/v1/chat/completions \</div>
                  <div>  -H "Authorization: Bearer YOUR_API_KEY" \</div>
                  <div>  -H "Content-Type: application/json" \</div>
                  <div>  -d '{`{`}</div>
                  <div>    "model": "gpt-3.5-turbo",</div>
                  <div>    "messages": [</div>
                  <div>      {`{"role": "user", "content": "Hello!"}`}</div>
                  <div>    ]</div>
                  <div>  {`}`}'</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Available Models</h4>
                <p className="text-sm text-muted-foreground">
                  Visit the LiteLLM dashboard to see available models and their pricing.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
