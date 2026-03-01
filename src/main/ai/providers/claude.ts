import type { AIProviderType } from '../../scanners/types';
import type { ChatRequest, ChatResponse, ChatMessage } from '../types';
import { BaseAIProvider } from '../provider';

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const API_VERSION = '2023-06-01';

interface ClaudeMessageContent {
  type: string;
  text?: string;
}

interface ClaudeResponse {
  content: ClaudeMessageContent[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class ClaudeProvider extends BaseAIProvider {
  readonly type: AIProviderType = 'claude';
  readonly name = 'Claude';

  protected getEndpoint(): string {
    const base = this.baseUrl || DEFAULT_BASE_URL;
    return `${base.replace(/\/$/, '')}/v1/messages`;
  }

  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': API_VERSION,
    };
  }

  protected buildRequestBody(request: ChatRequest): unknown {
    // Claude API requires system message as a top-level field, not in messages array
    const systemMessage = request.messages.find((m) => m.role === 'system');
    const chatMessages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m: ChatMessage) => ({
        role: m.role,
        content: m.content,
      }));

    return {
      model: this.model || DEFAULT_MODEL,
      max_tokens: request.maxTokens ?? 1024,
      ...(systemMessage ? { system: systemMessage.content } : {}),
      messages: chatMessages,
    };
  }

  protected parseResponse(body: unknown): ChatResponse {
    const res = body as ClaudeResponse;
    const text = res.content
      ?.filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');

    return {
      content: text || '',
      usage: res.usage
        ? {
            inputTokens: res.usage.input_tokens,
            outputTokens: res.usage.output_tokens,
          }
        : undefined,
    };
  }
}
