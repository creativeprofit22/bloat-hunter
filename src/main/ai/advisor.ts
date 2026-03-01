import type { AIProviderType, AIAdvice, AIProviderConfig, ScanResult } from '../scanners/types';
import type { AIProvider, ProviderOptions } from './types';
import { ClaudeProvider } from './providers/claude';
import { OpenAIProvider } from './providers/openai';
import { OllamaProvider } from './providers/ollama';
import { SYSTEM_PROMPT, buildAnalysisPrompt, buildExplainItemPrompt } from './prompts';

function createProvider(config: AIProviderConfig): AIProvider | null {
  if (config.type === 'none') return null;

  const opts: ProviderOptions = {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
  };

  switch (config.type) {
    case 'claude':
      return new ClaudeProvider(opts);
    case 'openai':
      return new OpenAIProvider(opts);
    case 'ollama':
      return new OllamaProvider(opts);
  }
}

/**
 * AI Advisor — takes scan results, calls the configured provider, returns structured advice.
 * All methods are safe to call with no provider configured — they return null.
 */
export class Advisor {
  private provider: AIProvider | null = null;

  configure(config: AIProviderConfig): void {
    this.provider = createProvider(config);
  }

  get providerType(): AIProviderType {
    return this.provider?.type ?? 'none';
  }

  get isConfigured(): boolean {
    return this.provider !== null;
  }

  /** Analyze scan results and return structured advice */
  async analyze(results: ScanResult[]): Promise<AIAdvice | null> {
    if (!this.provider || results.length === 0) return null;

    const response = await this.provider.chat({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildAnalysisPrompt(results) },
      ],
      maxTokens: 2048,
      temperature: 0.3,
    });

    return parseAdviceResponse(response.content);
  }

  /** Explain a single item */
  async explainItem(result: ScanResult): Promise<string | null> {
    if (!this.provider) return null;

    const response = await this.provider.chat({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildExplainItemPrompt(result) },
      ],
      maxTokens: 512,
      temperature: 0.3,
    });

    return response.content;
  }

  /** Test the current provider connection */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.provider) return { ok: false, error: 'No AI provider configured' };
    return this.provider.testConnection();
  }
}

/**
 * Parse the AI's JSON response into structured advice.
 * Falls back to a plain-text summary if JSON parsing fails.
 */
function parseAdviceResponse(content: string): AIAdvice {
  try {
    // Try to extract JSON from the response (may be wrapped in markdown code block)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      return {
        summary: String(parsed.summary ?? ''),
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations.map(
              (r: Record<string, unknown>) =>
                ({
                  category: String(r.category ?? ''),
                  action: String(r.action ?? ''),
                  reasoning: String(r.reasoning ?? ''),
                  risk: validateRisk(r.risk),
                }) as AIAdvice['recommendations'][number],
            )
          : [],
        riskAssessment: String(parsed.riskAssessment ?? ''),
      };
    }
  } catch {
    // JSON parsing failed — fall through to plain text fallback
  }

  // Fallback: treat the entire response as a summary
  return {
    summary: content,
    recommendations: [],
    riskAssessment: '',
  };
}

function validateRisk(value: unknown): 'green' | 'yellow' | 'red' {
  if (value === 'green' || value === 'yellow' || value === 'red') return value;
  return 'yellow';
}

/** Singleton advisor instance used by IPC handlers */
export const advisor = new Advisor();
