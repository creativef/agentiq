// ============================================================
// LLM PROVIDER ABSTRACTION
// Provider-agnostic interface for CEO reasoning.
// Supports: OpenAI, Anthropic, self-hosted OpenAI-compatible, Ollama/local
// ============================================================

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProviderConfig {
  id: string;
  provider: "openai" | "anthropic" | "openai-compatible" | "ollama" | "local";
  model: string;           // e.g., "gpt-4o", "claude-3-5-sonnet-20241022", "llama3.1:8b"
  baseUrl?: string;        // For self-hosted: http://localhost:11434/v1
  apiKey?: string;         // Not required for local/ollama
  maxTokens?: number;
  temperature?: number;
}

export interface LLMProvider {
  config: LLMProviderConfig;
  chat(messages: LLMMessage[]): Promise<LLMResponse>;
}

// ---------- OpenAI Provider ----------
export class OpenAIProvider implements LLMProvider {
  constructor(public config: LLMProviderConfig) {}

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || "https://api.openai.com/v1";
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: this.config.temperature ?? 0.3,
        max_tokens: this.config.maxTokens ?? 4000,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return {
      content: data.choices[0].message.content,
      usage: data.usage,
    };
  }
}

// ---------- Anthropic Provider ----------
export class AnthropicProvider implements LLMProvider {
  constructor(public config: LLMProviderConfig) {}

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const systemMsg = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens ?? 4000,
        system: systemMsg?.content || "",
        messages: userMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        temperature: this.config.temperature ?? 0.3,
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return {
      content: data.content?.[0]?.text || "",
      usage: data.usage,
    };
  }
}

// ---------- OpenAI-Compatible Provider (self-hosted) ----------
// Works with vLLM, Ollama (via /v1 endpoint), LM Studio, etc.
export class OpenAICompatibleProvider implements LLMProvider {
  constructor(public config: LLMProviderConfig) {}

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || this.config.baseUrl;
    if (!baseUrl) throw new Error("baseUrl required for self-hosted provider");

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: this.config.temperature ?? 0.3,
        max_tokens: this.config.maxTokens ?? 4000,
      }),
    });
    if (!res.ok) throw new Error(`Self-hosted API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return {
      content: data.choices[0].message.content,
      usage: data.usage,
    };
  }
}

// ---------- Ollama Provider (native /api/chat endpoint) ----------
export class OllamaProvider implements LLMProvider {
  constructor(public config: LLMProviderConfig) {}

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const baseUrl = (this.config.baseUrl || "http://localhost:11434").replace(/\/$/, "");

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false,
        options: {
          temperature: this.config.temperature ?? 0.3,
          num_predict: this.config.maxTokens ?? 4000,
        },
      }),
    });
    if (!res.ok) throw new Error(`Ollama API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return {
      content: data.message?.content || "",
      usage: data.prompt_eval_count ? {
        promptTokens: data.prompt_eval_count,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      } : undefined,
    };
  }
}

// ---------- Provider Factory ----------
export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.provider) {
    case "openai":
      return new OpenAIProvider(config);
    case "anthropic":
      return new AnthropicProvider(config);
    case "openai-compatible":
      return new OpenAICompatibleProvider(config);
    case "ollama":
      return new OllamaProvider(config);
    case "local":
      // "local" is treated as openai-compatible with localhost
      return new OpenAICompatibleProvider({
        ...config,
        baseUrl: config.baseUrl || "http://localhost:11434/v1",
      });
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}
