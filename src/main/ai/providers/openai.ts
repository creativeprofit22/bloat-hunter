import type { AIProviderType } from '../../scanners/types';
import type { ChatRequest, ChatResponse, ChatMessage } from '../types';
import { BaseAIProvider } from '../provider';

const DEFAULT_BASE_URL = 'https://api.openai.com';
const DEFAULT_MODEL = 'gpt-4o-mini';

interface OpenAIChoice {
  message: { role: string; content: string };
}

interface OpenAIResponse {
  choices: OpenAIChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export class OpenAIProvider extends BaseAIProvider {
  readonly type: AIProviderType = 'openai';
  readonly name = 'OpenAI';

  protected getEndpoint(): string {
    const base = this.baseUrl || DEFAULT_BASE_URL;
    return `${base.replace(/\/$/, '')}/v1/chat/completions`;
  }

  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  protected buildRequestBody(request: ChatRequest): unknown {
    return {
      model: this.model || DEFAULT_MODEL,
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature ?? 0.3,
      messages: request.messages.map((m: ChatMessage) => ({
        role: m.role,
        content: m.content,
      })),
    };
  }

  protected parseResponse(body: unknown): ChatResponse {
    const res = body as OpenAIResponse;
    const text = res.choices?.[0]?.message?.content ?? '';

    return {
      content: text,
      usage: res.usage
        ? {
            inputTokens: res.usage.prompt_tokens,
            outputTokens: res.usage.completion_tokens,
          }
        : undefined,
    };
  }
}
