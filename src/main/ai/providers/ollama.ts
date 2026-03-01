import type { AIProviderType } from '../../scanners/types';
import type { ChatRequest, ChatResponse, ChatMessage } from '../types';
import { BaseAIProvider } from '../provider';

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

interface OllamaMessage {
  role: string;
  content: string;
}

interface OllamaResponse {
  message?: OllamaMessage;
  eval_count?: number;
  prompt_eval_count?: number;
}

export class OllamaProvider extends BaseAIProvider {
  readonly type: AIProviderType = 'ollama';
  readonly name = 'Ollama';

  protected getEndpoint(): string {
    const base = this.baseUrl || DEFAULT_BASE_URL;
    return `${base.replace(/\/$/, '')}/api/chat`;
  }

  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  }

  protected buildRequestBody(request: ChatRequest): unknown {
    return {
      model: this.model || DEFAULT_MODEL,
      stream: false,
      messages: request.messages.map((m: ChatMessage) => ({
        role: m.role,
        content: m.content,
      })),
    };
  }

  protected parseResponse(body: unknown): ChatResponse {
    const res = body as OllamaResponse;
    const text = res.message?.content ?? '';

    return {
      content: text,
      usage:
        res.prompt_eval_count != null || res.eval_count != null
          ? {
              inputTokens: res.prompt_eval_count ?? 0,
              outputTokens: res.eval_count ?? 0,
            }
          : undefined,
    };
  }
}
