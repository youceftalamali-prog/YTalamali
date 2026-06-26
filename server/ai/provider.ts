import { GoogleGenAI } from "@google/genai";
import { OpenAI } from "openai";
import { DatabaseManager } from "../db.ts";
import {
  AIProviderName,
  AIProviderConfig,
  AIRequestOptions,
} from "../../src/types.ts";

export type { AIProviderName };
export type { AIProviderConfig, AIRequestOptions };
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

// Track failures for Circuit-Breaker
const providerFailures: Record<AIProviderName, { consecutive: number; lastFailureTime: number }> = {
  deepseek: { consecutive: 0, lastFailureTime: 0 },
  gemini: { consecutive: 0, lastFailureTime: 0 },
  openai: { consecutive: 0, lastFailureTime: 0 },
  kling: { consecutive: 0, lastFailureTime: 0 },
};
const BREAKER_RESET_MS = 120000; // 2 minutes

function markProviderSuccess(provider: AIProviderName): void {
  const state = providerFailures[provider];
  state.consecutive = 0;
  state.lastFailureTime = 0;
}

function markProviderFailure(provider: AIProviderName): void {
  const state = providerFailures[provider];
  state.consecutive += 1;
  state.lastFailureTime = Date.now();
}

function isProviderCircuitOpen(provider: AIProviderName): boolean {
  const state = providerFailures[provider];
  if (state.consecutive < 3) {
    return false;
  }
  return Date.now() - state.lastFailureTime < BREAKER_RESET_MS;
}

function isProviderConfigured(provider: AIProviderName): boolean {
  switch (provider) {
    case "deepseek":
      return Boolean(process.env.DEEPSEEK_API_KEY);
    case "gemini":
      return Boolean(process.env.GEMINI_API_KEY);
    case "openai":
      return Boolean(process.env.OPENAI_API_KEY);
    case "kling":
      return Boolean(process.env.KLING_API_KEY);
    default:
      return false;
  }
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
      case "kling":
        return "kling-default";
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

  /**
   * Resolve the API key for a given provider.
   * Tries workspace-specific key first, then falls back to environment variable.
   */
  private static async getProviderApiKey(
    workspaceId: string | undefined,
    provider: AIProviderName
  ): Promise<string | null> {
    if (workspaceId) {
      try {
        const db = await DatabaseManager.getInstance();
        const key = await db.getAIProviderApiKey(workspaceId, provider);
        if (key) {
          return key;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[AIProviderService] Failed to fetch key from DB for ${provider}:`, message);
        // Fall through to environment
      }
    }

    // Fallback to environment variables
    switch (provider) {
      case "deepseek":
        return process.env.DEEPSEEK_API_KEY || null;
      case "gemini":
        return process.env.GEMINI_API_KEY || null;
      case "openai":
        return process.env.OPENAI_API_KEY || null;
      case "kling":
        return process.env.KLING_API_KEY || null;
      default:
        return null;
    }
  }

  private static async generateWithDeepSeek(
    prompt: string,
    systemInstruction: string,
    schemaDescription: string,
    modelUsed: string,
    temperature: number,
    start: number,
    apiKey: string
  ): Promise<ProviderResponse> {
    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com/v1",
    });
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
    start: number,
    apiKey: string
  ): Promise<ProviderResponse> {
    const client = new GoogleGenAI({ apiKey });
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
    start: number,
    apiKey: string
  ): Promise<ProviderResponse> {
    const client = new OpenAI({ apiKey });
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
   *
   * @param workspaceId Optional workspace ID to use database‑stored API key.
   *                    If omitted, falls back to environment variables.
   */
  public static async generateJSON<T>(
    prompt: string,
    systemInstruction: string,
    schemaDescription: string,
    config: AIRequestOptions = {},
    workspaceId?: string
  ): Promise<ProviderResponse> {
    const start = Date.now();
    const providerOrder = this.resolveProviderOrder(config);
    const temperature = config.temperature ?? 0.2;
    let lastError: unknown = null;

    for (let attemptIndex = 0; attemptIndex < providerOrder.length; attemptIndex++) {
      const providerName = providerOrder[attemptIndex];

      // Resolve API key (DB first, then environment)
      const apiKey = await this.getProviderApiKey(workspaceId, providerName);
      if (!apiKey) {
        console.warn(`[AI Provider Layer] Skipping ${providerName}: no API key available.`);
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
            start,
            apiKey
          );
        } else if (providerName === "gemini") {
          response = await this.generateWithGemini(
            prompt,
            systemInstruction,
            modelUsed,
            temperature,
            start,
            apiKey
          );
        } else if (providerName === "openai") {
          response = await this.generateWithOpenAI(
            prompt,
            systemInstruction,
            schemaDescription,
            modelUsed,
            temperature,
            start,
            apiKey
          );
        } else {
          // Kling or other providers – not supported for generation in this version.
          throw new Error(`Provider ${providerName} is not supported for JSON generation.`);
        }

        markProviderSuccess(providerName);
        return response;
      } catch (err: unknown) {
        markProviderFailure(providerName);
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[AI Provider Layer] Error in generation with ${providerName}:`, message);
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

  /**
   * Test the connection to a specific AI provider.
   * Returns success status, provider name, and a message.
   * Supports DeepSeek, OpenAI, Gemini, and Kling.
   */
  public static async testProviderConnection(
    workspaceId: string,
    provider: AIProviderName
  ): Promise<{ success: boolean; provider: AIProviderName; message: string }> {
    try {
      const apiKey = await this.getProviderApiKey(workspaceId, provider);
      if (!apiKey) {
        return {
          success: false,
          provider,
          message: `No API key found for ${provider}.`,
        };
      }

      let testFn: () => Promise<boolean>;

      switch (provider) {
        case "deepseek": {
          testFn = async () => {
            const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com/v1" });
            const res = await client.models.list();
            return res.data && res.data.length > 0;
          };
          break;
        }
        case "openai": {
          testFn = async () => {
            const client = new OpenAI({ apiKey });
            const res = await client.models.list();
            return res.data && res.data.length > 0;
          };
          break;
        }
        case "gemini": {
          testFn = async () => {
            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
            );
            return response.ok;
          };
          break;
        }
        case "kling": {
          // Kling does not have a standard models endpoint; check key presence only.
          return {
            success: true,
            provider,
            message: "Kling API key validated (no additional test available).",
          };
        }
        default:
          return {
            success: false,
            provider,
            message: `Unsupported provider: ${provider}`,
          };
      }

      const result = await testFn();
      if (result) {
        return { success: true, provider, message: `${provider} connection successful.` };
      } else {
        return { success: false, provider, message: `${provider} connection test failed.` };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        provider,
        message: `Connection test error: ${message}`,
      };
    }
  }
}
