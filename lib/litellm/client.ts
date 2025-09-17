/**
 * LiteLLM API client for key management, token counting, and analytics
 */

export interface LiteLLMKeyGenerateRequest {
  user_id?: string;
  key_alias?: string;
  max_budget?: number; // in dollars
  budget_duration?: string; // e.g., "30d", "1h"
  models?: string[];
  rpm_limit?: number;
  tpm_limit?: number;
  metadata?: Record<string, any>;
  guardrails?: string[];
  duration?: string; // key validity duration
}

export interface LiteLLMKeyGenerateResponse {
  key: string;
  expires?: string;
  user_id?: string;
}

export interface LiteLLMKeyUpdateRequest {
  key: string;
  max_budget?: number;
  spend?: number;
  rpm_limit?: number;
  tpm_limit?: number;
  metadata?: Record<string, any>;
  blocked?: boolean;
  models?: string[];
  guardrails?: string[];
}

export interface LiteLLMTokenCountRequest {
  model: string;
  prompt?: string;
  messages?: any[];
  contents?: any[];
}

export interface LiteLLMTokenCountResponse {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface LiteLLMSpendDailyRequest {
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  model?: string;
  api_key?: string;
  page?: number;
  page_size?: number;
}

export interface LiteLLMSpendDailyResponse {
  results: Array<{
    date: string;
    metrics: {
      spend: number;
      prompt_tokens: number;
      completion_tokens: number;
      cache_read_input_tokens: number;
      cache_creation_input_tokens: number;
      total_tokens: number;
      successful_requests: number;
      failed_requests: number;
      api_requests: number;
    };
    breakdown: {
      models: Record<string, any>;
      api_keys: Record<string, any>;
      providers: Record<string, any>;
    };
  }>;
  metadata: {
    total_spend: number;
    total_tokens: number;
    page: number;
    total_pages: number;
    has_more: boolean;
  };
}

class LiteLLMClient {
  private baseUrl: string;
  private masterKey: string;
  private keyGenerateUrl: string;
  private keyUpdateUrl: string;
  private tokenCounterUrl: string;
  private spendDailyUrl: string;

  constructor() {
    this.baseUrl = process.env.LITELLM_BASE_URL || '';
    this.masterKey = process.env.LITELLM_MASTER_KEY || '';
    this.keyGenerateUrl = process.env.LITELLM_KEY_GENERATE_URL || `${this.baseUrl}/key/generate`;
    this.keyUpdateUrl = process.env.LITELLM_KEY_UPDATE_URL || `${this.baseUrl}/key/update`;
    this.tokenCounterUrl = process.env.LITELLM_TOKEN_COUNTER_URL || `${this.baseUrl}/utils/token_counter`;
    this.spendDailyUrl = process.env.LITELLM_SPEND_DAILY_URL || `${this.baseUrl}/spend/daily`;

    if (!this.baseUrl || !this.masterKey) {
      console.warn('LiteLLM configuration missing. Some features may not work.');
    }
  }

  private async makeRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.masterKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LiteLLM API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  async generateKey(request: LiteLLMKeyGenerateRequest): Promise<LiteLLMKeyGenerateResponse> {
    return this.makeRequest<LiteLLMKeyGenerateResponse>(this.keyGenerateUrl, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async updateKey(request: LiteLLMKeyUpdateRequest): Promise<void> {
    await this.makeRequest(this.keyUpdateUrl, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async countTokens(request: LiteLLMTokenCountRequest, callEndpoint = false): Promise<LiteLLMTokenCountResponse> {
    const url = `${this.tokenCounterUrl}?call_endpoint=${callEndpoint}`;
    return this.makeRequest<LiteLLMTokenCountResponse>(url, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getSpendDaily(request: LiteLLMSpendDailyRequest = {}): Promise<LiteLLMSpendDailyResponse> {
    const params = new URLSearchParams();
    if (request.start_date) params.append('start_date', request.start_date);
    if (request.end_date) params.append('end_date', request.end_date);
    if (request.model) params.append('model', request.model);
    if (request.api_key) params.append('api_key', request.api_key);
    if (request.page) params.append('page', request.page.toString());
    if (request.page_size) params.append('page_size', request.page_size.toString());

    const url = `${this.spendDailyUrl}?${params.toString()}`;
    return this.makeRequest<LiteLLMSpendDailyResponse>(url);
  }

  // Utility method to check if LiteLLM is configured
  isConfigured(): boolean {
    return !!(this.baseUrl && this.masterKey);
  }

  // Retry wrapper with exponential backoff
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`LiteLLM operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}

// Export singleton instance
export const liteLLMClient = new LiteLLMClient();

// Export error types for better error handling
export class LiteLLMError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'LiteLLMError';
  }
}

export class LiteLLMConfigError extends Error {
  constructor(message: string = 'LiteLLM is not properly configured') {
    super(message);
    this.name = 'LiteLLMConfigError';
  }
}
