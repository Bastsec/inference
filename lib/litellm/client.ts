/**
 * LiteLLM API client for key management, token counting, and analytics
 */

export interface LiteLLMKeyGenerateRequest {
  user_id?: string;
  key_alias?: string;
  max_budget?: number; 
  budget_duration?: string; 
  models?: string[];
  rpm_limit?: number;
  tpm_limit?: number;
  metadata?: Record<string, any>;
  guardrails?: string[];
  duration?: string; 
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
  start_date?: string; 
  end_date?: string; 
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
  private modelsUrl: string;
  private supportedParamsUrl: string;
  private customerNewUrl: string;
  private customerInfoUrl: string;
  private userDailyActivityUrl: string;

  constructor() {
    this.baseUrl = process.env.LITELLM_BASE_URL || '';
    this.masterKey = process.env.LITELLM_MASTER_KEY || '';
    this.keyGenerateUrl = process.env.LITELLM_KEY_GENERATE_URL || `${this.baseUrl}/key/generate`;
    this.keyUpdateUrl = process.env.LITELLM_KEY_UPDATE_URL || `${this.baseUrl}/key/update`;
    this.tokenCounterUrl = process.env.LITELLM_TOKEN_COUNTER_URL || `${this.baseUrl}/utils/token_counter`;
    this.spendDailyUrl = process.env.LITELLM_SPEND_DAILY_URL || `${this.baseUrl}/spend/daily`;
    this.modelsUrl = process.env.LITELLM_MODELS_URL || `${this.baseUrl}/models`;
    this.supportedParamsUrl = process.env.LITELLM_SUPPORTED_PARAMS_URL || `${this.baseUrl}/utils/supported_openai_params`;
    this.customerNewUrl = process.env.LITELLM_CUSTOMER_NEW_URL || `${this.baseUrl}/customer/new`;
    this.customerInfoUrl = process.env.LITELLM_CUSTOMER_INFO_URL || `${this.baseUrl}/customer/info`;
    this.userDailyActivityUrl = process.env.LITELLM_USER_DAILY_ACTIVITY_URL || `${this.baseUrl}/user/daily/activity/aggregated`;

    if (!this.baseUrl || !this.masterKey) {
      console.warn('LiteLLM configuration missing. Some features may not work.');
    }
  }

  // GET /models (optionally filter by litellm_model_id)
  async getModels(litellm_model_id?: string): Promise<any> {
    const url = litellm_model_id
      ? `${this.modelsUrl}?litellm_model_id=${encodeURIComponent(litellm_model_id)}`
      : this.modelsUrl;
    return this.makeRequest<any>(url);
  }

  // GET /utils/supported_openai_params?model=...
  async getSupportedOpenAIParams(model: string): Promise<any> {
    const url = `${this.supportedParamsUrl}?model=${encodeURIComponent(model)}`;
    return this.makeRequest<any>(url);
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

  async createCustomer(request: LiteLLMCustomerCreateRequest): Promise<LiteLLMCustomerCreateResponse> {
    return this.makeRequest<LiteLLMCustomerCreateResponse>(this.customerNewUrl, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getCustomerInfo(endUserId: string): Promise<LiteLLMCustomerInfoResponse> {
    const url = `${this.customerInfoUrl}?end_user_id=${encodeURIComponent(endUserId)}`;
    return this.makeRequest<LiteLLMCustomerInfoResponse>(url);
  }

  async getUserDailyActivity(request: LiteLLMUserDailyActivityRequest = {}): Promise<LiteLLMUserDailyActivityResponse> {
    const params = new URLSearchParams();
    if (request.start_date) params.append('start_date', request.start_date);
    if (request.end_date) params.append('end_date', request.end_date);
    if (request.model) params.append('model', request.model);
    if (request.api_key) params.append('api_key', request.api_key);

    const url = `${this.userDailyActivityUrl}?${params.toString()}`;
    return this.makeRequest<LiteLLMUserDailyActivityResponse>(url);
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

export interface LiteLLMCustomerCreateRequest {
  user_id: string;
  alias?: string;
  blocked?: boolean;
  max_budget?: number;
  budget_id?: string;
  allowed_model_region?: 'eu' | 'us';
  default_model?: string;
  metadata?: Record<string, any>;
  budget_duration?: string;
  tpm_limit?: number;
  rpm_limit?: number;
  model_max_budget?: Record<string, any>;
  max_parallel_requests?: number;
  soft_budget?: number;
  spend?: number;
  budget_reset_at?: string;
}

export interface LiteLLMCustomerCreateResponse {
  user_id: string;
  blocked: boolean;
  alias?: string;
  spend: number;
  allowed_model_region?: 'eu' | 'us';
  default_model?: string;
  litellm_budget_table?: {
    budget_id?: string;
    soft_budget?: number;
    max_budget?: number;
    max_parallel_requests?: number;
    tpm_limit?: number;
    rpm_limit?: number;
    model_max_budget?: Record<string, any>;
    budget_duration?: string;
  };
}

export interface LiteLLMCustomerInfoResponse {
  user_id: string;
  blocked: boolean;
  alias?: string;
  spend: number;
  allowed_model_region?: 'eu' | 'us';
  default_model?: string;
  litellm_budget_table: {
    budget_id?: string;
    soft_budget?: number;
    max_budget?: number;
    max_parallel_requests?: number;
    tpm_limit?: number;
    rpm_limit?: number;
    model_max_budget?: Record<string, any>;
    budget_duration?: string;
    budget_reset_at?: string;
  };
}

export interface LiteLLMUserDailyActivityRequest {
  start_date?: string; // YYYY-MM-DD format
  end_date?: string; // YYYY-MM-DD format
  model?: string;
  api_key?: string;
}

export interface LiteLLMUserDailyActivityResponse {
  [date: string]: {
    spend: number;
    prompt_tokens: number;
    completion_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
    total_tokens: number;
    api_requests: number;
    models: {
      [model: string]: {
        spend: number;
        prompt_tokens: number;
        completion_tokens: number;
        cache_read_input_tokens: number;
        cache_creation_input_tokens: number;
        total_tokens: number;
        api_requests: number;
      };
    };
    api_keys: {
      [api_key: string]: {
        spend: number;
        prompt_tokens: number;
        completion_tokens: number;
        cache_read_input_tokens: number;
        cache_creation_input_tokens: number;
        total_tokens: number;
        api_requests: number;
      };
    };
    providers: {
      [provider: string]: {
        spend: number;
        prompt_tokens: number;
        completion_tokens: number;
        cache_read_input_tokens: number;
        cache_creation_input_tokens: number;
        total_tokens: number;
        api_requests: number;
      };
    };
  };
}
