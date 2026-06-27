// config/gemini.js
const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

const resolvedGeminiApiKey = String(
  process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GENAI_API_KEY || ""
).trim();

const genAI = resolvedGeminiApiKey
  ? new GoogleGenAI({ apiKey: resolvedGeminiApiKey })
  : null;

const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const modelFallbackCsv = String(process.env.GEMINI_MODEL_FALLBACKS || "gemini-2.0-flash").trim();
const modelFallbacks = modelFallbackCsv
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const modelCandidates = Array.from(new Set([modelName, ...modelFallbacks].filter(Boolean)));

const RETRYABLE_CODES = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_STATUSES = new Set([
  "UNAVAILABLE",
  "RESOURCE_EXHAUSTED",
  "DEADLINE_EXCEEDED",
  "INTERNAL"
]);
const MAX_ATTEMPTS = Math.max(1, Number.parseInt(process.env.GEMINI_MAX_ATTEMPTS || "5", 10) || 5);
const BASE_DELAY_MS = Math.max(100, Number.parseInt(process.env.GEMINI_RETRY_BASE_DELAY_MS || "1000", 10) || 1000);
const MAX_DELAY_MS = Math.max(BASE_DELAY_MS, Number.parseInt(process.env.GEMINI_RETRY_MAX_DELAY_MS || "12000", 10) || 12000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonSafe(value) {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function parseErrorMeta(error) {
  const parsedMessage = parseJsonSafe(error?.message);
  const parsedError = parsedMessage?.error || null;

  const rawCode = parsedError?.code ?? error?.code ?? error?.statusCode ?? error?.response?.status;
  const code = Number.isFinite(Number(rawCode)) ? Number(rawCode) : null;
  const status = String(parsedError?.status ?? error?.status ?? error?.error?.status ?? "").toUpperCase() || null;
  const message = String(parsedError?.message ?? error?.error?.message ?? error?.message ?? "Unknown Gemini error");

  return { code, status, message };
}

function isRetryableError(meta) {
  if (meta.code && RETRYABLE_CODES.has(meta.code)) return true;
  if (meta.status && RETRYABLE_STATUSES.has(meta.status)) return true;
  return /(high demand|temporar|unavailable|try again later|resource exhausted|timeout|timed out|overload)/i.test(meta.message);
}

function nextDelayMs(attempt) {
  const exponential = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * (2 ** Math.max(0, attempt - 1)));
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(MAX_DELAY_MS, exponential + jitter);
}

async function generateContentForModelWithRetry(prompt, model) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      if (!genAI) {
        throw new Error("Gemini API key is not configured.");
      }
      return await genAI.models.generateContent({
        model,
        contents: prompt
      });
    } catch (error) {
      lastError = error;
      const meta = parseErrorMeta(error);
      const retryable = isRetryableError(meta);
      const canRetry = retryable && attempt < MAX_ATTEMPTS;

      if (!canRetry) {
        console.error(`[Gemini] generateContent failed for ${model} (attempt ${attempt}/${MAX_ATTEMPTS})`, {
          code: meta.code,
          status: meta.status,
          message: meta.message
        });
        throw error;
      }

      const waitMs = nextDelayMs(attempt);
      console.warn(`[Gemini] transient error for ${model} (attempt ${attempt}/${MAX_ATTEMPTS}) - retrying in ${waitMs}ms`, {
        code: meta.code,
        status: meta.status,
        message: meta.message
      });
      await sleep(waitMs);
    }
  }

  throw lastError || new Error("Gemini generateContent failed");
}

function shouldTryNextModel(error) {
  const meta = parseErrorMeta(error);
  return meta.code === 503 || meta.status === "UNAVAILABLE" || meta.status === "RESOURCE_EXHAUSTED";
}

async function generateContentWithRetry(prompt) {
  let lastError = null;

  for (let index = 0; index < modelCandidates.length; index += 1) {
    const model = modelCandidates[index];
    try {
      return await generateContentForModelWithRetry(prompt, model);
    } catch (error) {
      lastError = error;
      const canTryNext = index < modelCandidates.length - 1 && shouldTryNextModel(error);
      if (!canTryNext) throw error;
      console.warn(`[Gemini] switching model due to demand: ${model} -> ${modelCandidates[index + 1]}`);
    }
  }

  throw lastError || new Error("Gemini generateContent failed");
}

const textModel = {
  generateContent: async (prompt) => {
    try {
      const response = await generateContentWithRetry(prompt);
      // Mock the old SDK's structure to minimize changes in services
      return {
        response: {
          text: () => response.text
        },
        text: response.text // Also provide the new direct access
      };
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }
};

module.exports = { genAI, textModel, modelName };

export {};
