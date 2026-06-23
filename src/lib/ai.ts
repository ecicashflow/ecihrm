/**
 * src/lib/ai.ts
 *
 * Thin wrapper around any OpenAI-compatible Chat Completions API.
 * Supports OpenAI, Groq, and other compatible providers.
 *
 * Environment variables (in priority order):
 *   AI_API_KEY   — the API key (required for AI to work)
 *   AI_BASE_URL  — the API base URL (e.g., https://api.groq.com/openai/v1)
 *   AI_MODEL     — the model name (e.g., llama-3.3-70b-versatile)
 *
 * Legacy fallback (still supported):
 *   OPENAI_API_KEY, OPENAI_MODEL (base URL defaults to OpenAI)
 */

import OpenAI from 'openai';

let client: OpenAI | null = null;

function getApiKey(): string | undefined {
  return process.env.AI_API_KEY || process.env.OPENAI_API_KEY || undefined;
}

function getBaseUrl(): string | undefined {
  return process.env.AI_BASE_URL || undefined;
}

function getModel(): string {
  return process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

export function aiEnabled(): boolean {
  return !!getApiKey();
}

export function getAIClient(): OpenAI {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'AI features are not configured. Set AI_API_KEY (and optionally AI_BASE_URL, AI_MODEL) in your environment variables.'
    );
  }
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: getBaseUrl(),
    });
  }
  return client;
}

export const AI_MODEL = getModel();

/**
 * Send a chat completion request and return the text response.
 */
export async function getLLMResponse(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const openai = getAIClient();
  const response = await openai.chat.completions.create({
    model: getModel(),
    messages,
    temperature: 0.4,
  });
  return response.choices?.[0]?.message?.content || '';
}
