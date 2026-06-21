/**
 * src/lib/ai.ts
 *
 * Thin wrapper around the OpenAI Chat Completions API used by the
 * ECI HRM AI features (appraisal analysis + cycle summary).
 *
 * - Uses the official `openai` npm package (works on Vercel/Node/Edge).
 * - Reads OPENAI_API_KEY from the environment. If missing, callers
 *   should gracefully degrade (see `aiEnabled()`).
 * - Model is configurable via OPENAI_MODEL (defaults to gpt-4o-mini).
 */

import OpenAI from 'openai';

let client: OpenAI | null = null;

export function aiEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export function getAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured. Set it in your environment variables.');
  }
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return client;
}

export const AI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * Send a single user prompt to the LLM and return the text response.
 */
export async function getLLMResponse(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const openai = getAIClient();
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages,
    temperature: 0.4,
  });
  return response.choices?.[0]?.message?.content || '';
}
