import type { AIProviderType } from '../scanners/types';
import type { AIProvider, ProviderOptions, ChatRequest, ChatResponse } from './types';

/**
 * Base class for AI providers. Handles common fetch logic and error handling.
 * Subclasses implement `buildRequest` and `parseResponse` for their specific API format.
 */
export abstract class BaseAIProvider implements AIProvider {
  abstract readonly type: AIProviderType;
  abstract readonly name: string;

  protected apiKey: string;
  protected baseUrl: string;
  protected model: string;

  constructor(options: ProviderOptions) {
    this.apiKey = options.apiKey ?? '';
    this.baseUrl = options.baseUrl ?? '';
    this.model = options.model ?? '';
  }

  /** Build the full URL for the chat endpoint */
  protected abstract getEndpoint(): string;

  /** Build the request body for the provider's API format */
  protected abstract buildRequestBody(request: ChatRequest): unknown;

  /** Build request headers (auth, content-type) */
  protected abstract buildHeaders(): Record<string, string>;

  /** Parse the provider's response format into a standard ChatResponse */
  protected abstract parseResponse(body: unknown): ChatResponse;

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const endpoint = this.getEndpoint();
    const headers = this.buildHeaders();
    const body = this.buildRequestBody(request);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${this.name} API error (${res.status}): ${text || res.statusText}`);
    }

    const json = await res.json();
    return this.parseResponse(json);
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 16,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
