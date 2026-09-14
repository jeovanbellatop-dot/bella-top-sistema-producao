import OpenAI from "openai";

let openaiInstance: OpenAI | null = null;

/**
 * Obtém ou inicializa a instância do cliente OpenAI.
 * A credencial é lida exclusivamente de process.env.OPENAI_API_KEY.
 * Nunca é enviada ao cliente ou exposta em logs públicos.
 */
export function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "MY_OPENAI_API_KEY") {
    return null;
  }

  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: apiKey.trim(),
    });
  }

  return openaiInstance;
}

/**
 * Retorna o modelo OpenAI configurado no ambiente, defaulting para gpt-4o.
 */
export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o";
}
