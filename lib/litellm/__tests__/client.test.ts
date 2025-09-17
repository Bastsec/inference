import { liteLLMClient, LiteLLMError, LiteLLMConfigError } from '../client';

// Mock fetch for testing
global.fetch = jest.fn();

describe('LiteLLMClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env.LITELLM_BASE_URL = 'https://test-litellm.com';
    process.env.LITELLM_MASTER_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.LITELLM_BASE_URL;
    delete process.env.LITELLM_MASTER_KEY;
  });

  describe('Configuration', () => {
    it('should be configured when environment variables are set', () => {
      expect(liteLLMClient.isConfigured()).toBe(true);
    });

    it('should not be configured when environment variables are missing', () => {
      delete process.env.LITELLM_BASE_URL;
      delete process.env.LITELLM_MASTER_KEY;
      
      // Create new instance to test configuration
      const { LiteLLMClient } = require('../client');
      const client = new LiteLLMClient();
      
      expect(client.isConfigured()).toBe(false);
    });
  });

  describe('generateKey', () => {
    it('should generate a key successfully', async () => {
      const mockResponse = {
        key: 'sk-test123',
        expires: '2024-12-31T23:59:59Z',
        user_id: 'user-123'
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await liteLLMClient.generateKey({
        user_id: 'user-123',
        max_budget: 10.0,
        rpm_limit: 100
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        'https://test-litellm.com/key/generate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should throw error on API failure', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request')
      });

      await expect(liteLLMClient.generateKey({
        user_id: 'user-123'
      })).rejects.toThrow('LiteLLM API error (400): Bad request');
    });
  });

  describe('countTokens', () => {
    it('should count tokens successfully', async () => {
      const mockResponse = {
        total_tokens: 100,
        prompt_tokens: 80,
        completion_tokens: 20
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await liteLLMClient.countTokens({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        'https://test-litellm.com/utils/token_counter?call_endpoint=false',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should handle call_endpoint parameter', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ total_tokens: 50 })
      });

      await liteLLMClient.countTokens({
        model: 'gpt-3.5-turbo',
        prompt: 'Test prompt'
      }, true);

      expect(fetch).toHaveBeenCalledWith(
        'https://test-litellm.com/utils/token_counter?call_endpoint=true',
        expect.any(Object)
      );
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await liteLLMClient.withRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success');
      
      const result = await liteLLMClient.withRetry(operation, 3, 10);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw last error after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      
      await expect(liteLLMClient.withRetry(operation, 2, 10))
        .rejects.toThrow('Persistent failure');
      
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('updateKey', () => {
    it('should update a key successfully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      await liteLLMClient.updateKey({
        key: 'sk-test123',
        max_budget: 20.0,
        blocked: false
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://test-litellm.com/key/update',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            key: 'sk-test123',
            max_budget: 20.0,
            blocked: false
          })
        })
      );
    });
  });

  describe('getSpendDaily', () => {
    it('should get spend data with filters', async () => {
      const mockResponse = {
        results: [
          {
            date: '2024-01-01',
            metrics: {
              spend: 5.0,
              total_tokens: 1000,
              api_requests: 10
            }
          }
        ],
        metadata: {
          total_spend: 5.0,
          page: 1,
          has_more: false
        }
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await liteLLMClient.getSpendDaily({
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        model: 'gpt-4',
        page: 1,
        page_size: 50
      });

      expect(result).toEqual(mockResponse);
      
      const expectedUrl = 'https://test-litellm.com/spend/daily?start_date=2024-01-01&end_date=2024-01-31&model=gpt-4&page=1&page_size=50';
      expect(fetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
    });

    it('should handle empty parameters', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], metadata: {} })
      });

      await liteLLMClient.getSpendDaily();

      expect(fetch).toHaveBeenCalledWith(
        'https://test-litellm.com/spend/daily?',
        expect.any(Object)
      );
    });
  });
});

describe('Error Classes', () => {
  it('should create LiteLLMError with status code', () => {
    const error = new LiteLLMError('Test error', 400);
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('LiteLLMError');
  });

  it('should create LiteLLMConfigError with default message', () => {
    const error = new LiteLLMConfigError();
    expect(error.message).toBe('LiteLLM is not properly configured');
    expect(error.name).toBe('LiteLLMConfigError');
  });
});
