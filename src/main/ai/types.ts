import type { AIProviderType } from '../scanners/types';

// ── Chat Message Types ──────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ── Provider Interface ──────────────────────────────────────────────

export interface AIProvider {
  readonly type: AIProviderType;
  readonly name: string;

  /** Send a chat completion request */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /** Test whether the provider is configured and reachable */
  testConnection(): Promise<{ ok: boolean; error?: string }>;
}

// ── Provider Configuration ──────────────────────────────────────────

export interface ProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}
