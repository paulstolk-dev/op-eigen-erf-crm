import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

// Kiest het LLM-model voor de CRM. Gebruikt de DIRECTE Anthropic-API zodra
// ANTHROPIC_API_KEY gezet is (de Vercel AI Gateway-credits kunnen op zijn);
// anders valt het terug op de kale model-string die de AI SDK via de Gateway
// routeert. modelId mag met of zonder 'anthropic/'-prefix — de directe provider
// wil de kale id (bv. 'claude-haiku-4-5').
export function chatModel(modelId: string): LanguageModel {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const anthropic = createAnthropic({
      apiKey,
      ...(process.env.ANTHROPIC_BASE_URL
        ? { baseURL: process.env.ANTHROPIC_BASE_URL }
        : {}),
    });
    return anthropic(modelId.replace(/^anthropic\//, ""));
  }
  return modelId; // Gateway-fallback (kale string)
}
