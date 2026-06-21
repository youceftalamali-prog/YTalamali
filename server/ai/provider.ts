import { GoogleGenAI } from "@google/genai";
import { OpenAI } from "openai";

export type AIProviderName = "deepseek" | "gemini" | "openai";
export type AIWorkflow = "standard" | "advanced_reasoning" | "video" | "image";

export interface ProviderResponse {
  rawContent: string;
  provider: AIProviderName;
  modelUsed: string;
  tokensConsumed?: {
    prompt: number;
    completion: number;
  };
  latencyMs: number;
}

export interface AIProviderConfig {
  apiKey?: string;
  modelName?: string;
  temperature?: number;
  workflow?: AIWorkflow;
  preferredProvider?: AIProviderName;
  allowFallbacks?: boolean;
}

// Lazy loaded client instances to protect server lifecycle during initialization
let deepseekClient: OpenAI | null = null;
let geminiClient: GoogleGenAI | null = null;
let openaiClient: OpenAI | null = null;

// Track failures for Circuit-Breaker
const providerFailures: Record<AIProviderName, { consecutive: number; lastFailureTime: number }> = {
  deepseek: { consecutive: 0, lastFailureTime: 0 },
  gemini: { consecutive: 0, lastFailureTime: 0 },
  openai: { consecutive: 0, lastFailureTime: 0 },
};
const BREAKER_RESET_MS = 120000; // 2 minutes

function getDeepSeekClient(): OpenAI {
  if (!deepseekClient) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY environment variable is not set on the server.");
    }
    deepseekClient = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com/v1",
    });
  }
  return deepseekClient;
}

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set on the server.");
    }
    // Strict telemetry header tracking as requested by platform guidelines
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set on the server.");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function getProviderState(provider: AIProviderName) {
  return providerFailures[provider];
}

function markProviderSuccess(provider: AIProviderName): void {
  const state = getProviderState(provider);
  state.consecutive = 0;
  state.lastFailureTime = 0;
}

function markProviderFailure(provider: AIProviderName): void {
  const state = getProviderState(provider);
  state.consecutive += 1;
  state.lastFailureTime = Date.now();
}

function isProviderCircuitOpen(provider: AIProviderName): boolean {
  const state = getProviderState(provider);
  if (state.consecutive < 3) {
    return false;
  }
  return Date.now() - state.lastFailureTime < BREAKER_RESET_MS;
}

export class AIProviderService {
  private static getDefaultModel(provider: AIProviderName): string {
    switch (provider) {
      case "deepseek":
        return process.env.DEEPSEEK_MODEL || "deepseek-chat";
      case "gemini":
        return process.env.GEMINI_MODEL || "gemini-2.5-flash";
      case "openai":
        return process.env.OPENAI_MODEL || "gpt-4o-mini";
    }
  }

  private static getBaseProviderOrder(workflow: AIWorkflow): AIProviderName[] {
    switch (workflow) {
      case "advanced_reasoning":
      case "video":
      case "image":
        return ["gemini", "openai"];
      case "standard":
      default:
        return ["deepseek", "gemini", "openai"];
    }
  }

  private static resolveProviderOrder(config: AIProviderConfig): AIProviderName[] {
    const workflow = config.workflow || "standard";
    const baseOrder = this.getBaseProviderOrder(workflow);

    if (!config.preferredProvider) {
      return config.allowFallbacks === false ? [baseOrder[0]] : baseOrder;
    }

    const ordered = [
      config.preferredProvider,
      ...baseOrder.filter((provider) => provider !== config.preferredProvider),
    ];
    return config.allowFallbacks === false ? [ordered[0]] : ordered;
  }

  private static isProviderConfigured(provider: AIProviderName): boolean {
    switch (provider) {
      case "deepseek":
        return Boolean(process.env.DEEPSEEK_API_KEY);
      case "gemini":
        return Boolean(process.env.GEMINI_API_KEY);
      case "openai":
        return Boolean(process.env.OPENAI_API_KEY);
    }
  }

  private static async generateWithDeepSeek(
    prompt: string,
    systemInstruction: string,
    schemaDescription: string,
    modelUsed: string,
    temperature: number,
    start: number
  ): Promise<ProviderResponse> {
    const client = getDeepSeekClient();
    console.log(`[AI Provider Layer] Calling Primary Provider: DeepSeek (${modelUsed})`);

    const completion = await client.chat.completions.create({
      model: modelUsed,
      messages: [
        { role: "system", content: `${systemInstruction}\n\nSchema expectations:\n${schemaDescription}` },
        { role: "user", content: prompt },
      ],
      temperature,
      response_format: { type: "json_object" },
    });

    return {
      rawContent: completion.choices[0]?.message?.content || "",
      provider: "deepseek",
      modelUsed,
      tokensConsumed: completion.usage
        ? {
            prompt: completion.usage.prompt_tokens,
            completion: completion.usage.completion_tokens,
          }
        : undefined,
      latencyMs: Date.now() - start,
    };
  }

  private static async generateWithGemini(
    prompt: string,
    systemInstruction: string,
    modelUsed: string,
    temperature: number,
    start: number
  ): Promise<ProviderResponse> {
    const client = getGeminiClient();
    console.log(`[AI Provider Layer] Calling Fallback Provider: Gemini (${modelUsed})`);

    const response = await client.models.generateContent({
      model: modelUsed,
      contents: prompt,
      config: {
        systemInstruction,
        temperature,
        responseMimeType: "application/json",
      },
    });

    return {
      rawContent: response.text || "",
      provider: "gemini",
      modelUsed,
      tokensConsumed: response.usageMetadata
        ? {
            prompt: response.usageMetadata.promptTokenCount || 0,
            completion: response.usageMetadata.candidatesTokenCount || 0,
          }
        : undefined,
      latencyMs: Date.now() - start,
    };
  }

  private static async generateWithOpenAI(
    prompt: string,
    systemInstruction: string,
    schemaDescription: string,
    modelUsed: string,
    temperature: number,
    start: number
  ): Promise<ProviderResponse> {
    const client = getOpenAIClient();
    console.log(`[AI Provider Layer] Calling Fallback Provider: OpenAI (${modelUsed})`);

    const completion = await client.chat.completions.create({
      model: modelUsed,
      messages: [
        { role: "system", content: `${systemInstruction}\n\nSchema expectations:\n${schemaDescription}` },
        { role: "user", content: prompt },
      ],
      temperature,
      response_format: { type: "json_object" },
    });

    return {
      rawContent: completion.choices[0]?.message?.content || "",
      provider: "openai",
      modelUsed,
      tokensConsumed: completion.usage
        ? {
            prompt: completion.usage.prompt_tokens,
            completion: completion.usage.completion_tokens,
          }
        : undefined,
      latencyMs: Date.now() - start,
    };
  }

  /**
   * Run JSON generation with adaptive failover.
   * Standard commerce workflows default to DeepSeek -> Gemini -> OpenAI.
   * Advanced reasoning, video, and image workflows stay on Gemini/OpenAI.
   */
  public static async generateJSON<T>(
    prompt: string,
    systemInstruction: string,
    schemaDescription: string,
    config: AIProviderConfig = {}
  ): Promise<ProviderResponse> {
    const start = Date.now();
    const providerOrder = this.resolveProviderOrder(config);
    const temperature = config.temperature ?? 0.2;
    let lastError: unknown = null;

    for (let attemptIndex = 0; attemptIndex < providerOrder.length; attemptIndex++) {
      const providerName = providerOrder[attemptIndex];

      if (!this.isProviderConfigured(providerName)) {
        console.warn(`[AI Provider Layer] Skipping ${providerName}: missing API key.`);
        continue;
      }

      if (isProviderCircuitOpen(providerName)) {
        console.warn(`[AI Provider Layer] Circuit-breaker active for ${providerName}. Skipping provider.`);
        continue;
      }

      const modelUsed = attemptIndex === 0 && config.modelName
        ? config.modelName
        : this.getDefaultModel(providerName);

      try {
        let response: ProviderResponse;
        if (providerName === "deepseek") {
          response = await this.generateWithDeepSeek(
            prompt,
            systemInstruction,
            schemaDescription,
            modelUsed,
            temperature,
            start
          );
        } else if (providerName === "gemini") {
          response = await this.generateWithGemini(
            prompt,
            systemInstruction,
            modelUsed,
            temperature,
            start
          );
        } else {
          response = await this.generateWithOpenAI(
            prompt,
            systemInstruction,
            schemaDescription,
            modelUsed,
            temperature,
            start
          );
        }

        markProviderSuccess(providerName);
        return response;
      } catch (err: unknown) {
        markProviderFailure(providerName);
        lastError = err;
        console.error(`[AI Provider Layer] Error in generation with ${providerName}:`, err);
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error("No configured AI providers were available for this request.");
  }

  /**
   * Safe JSON Parser & Healing Engine
   */
  public static cleanAndParseJSON<T>(rawContent: string): T {
    let sanitized = rawContent.trim();
    
    // 1. Remove markdown code fences if they wrap the content
    if (sanitized.startsWith("```")) {
      sanitized = sanitized.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    try {
      return JSON.parse(sanitized) as T;
    } catch (err) {
      console.warn(`[AI Provider Layer] Standard JSON parse failed. Running regex extract healing...`);
      
      // 2. Fallback Regex Extraction to pull the outer-most matching curly braces object
      const jsonRegex = /{[\s\S]*}/;
      const match = sanitized.match(jsonRegex);
      if (match) {
        try {
          return JSON.parse(match[0]) as T;
        } catch (innerErr) {
          console.error(`[AI Provider Layer] Regex extraction healing failed:`, innerErr);
        }
      }
      
      throw new Error(`Failed to parse AI output into valid JSON. Content was: ${rawContent.substring(0, 200)}...`);
    }
  }
}
