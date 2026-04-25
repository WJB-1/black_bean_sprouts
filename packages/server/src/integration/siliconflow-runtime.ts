const DEFAULT_BASE_URL = "https://api.siliconflow.cn/v1";
const DEFAULT_MODEL = "Qwen/Qwen2.5-7B-Instruct";

type SiliconFlowResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function resolveSiliconFlowBaseUrl(): string {
  return normalizeOptionalString(process.env.SILICONFLOW_BASE_URL) ?? DEFAULT_BASE_URL;
}

function resolveSiliconFlowModel(): string {
  const directModel = normalizeOptionalString(process.env.SILICONFLOW_MODEL);
  if (directModel) {
    return directModel;
  }

  const configured = normalizeOptionalString(process.env.OPENCLAW_MODEL);
  if (!configured) {
    return DEFAULT_MODEL;
  }

  const firstSlash = configured.indexOf("/");
  if (firstSlash < 0 || firstSlash >= configured.length - 1) {
    return configured;
  }

  const provider = configured.slice(0, firstSlash);
  const model = configured.slice(firstSlash + 1);
  return provider === "siliconflow" ? model : configured;
}

export async function runSiliconFlowTextPrompt(params: {
  message: string;
}): Promise<string> {
  const apiKey = normalizeOptionalString(process.env.SILICONFLOW_API_KEY);
  if (!apiKey) {
    throw new Error("SILICONFLOW_API_KEY is required");
  }

  try {
    return await requestSiliconFlowCompletion({
      apiKey,
      message: params.message,
      jsonObjectMode: true,
    });
  } catch (error) {
    return requestSiliconFlowCompletion({
      apiKey,
      message: params.message,
      jsonObjectMode: false,
      priorError: error,
    });
  }
}

async function requestSiliconFlowCompletion(params: {
  apiKey: string;
  message: string;
  jsonObjectMode: boolean;
  priorError?: unknown;
}): Promise<string> {
  const response = await fetch(`${resolveSiliconFlowBaseUrl().replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolveSiliconFlowModel(),
      messages: [
        {
          role: "user",
          content: params.message,
        },
      ],
      ...(params.jsonObjectMode ? { response_format: { type: "json_object" } } : {}),
      temperature: 0,
      top_p: 0.1,
      stream: false,
    }),
  });

  const payload = (await response.json()) as SiliconFlowResponse;
  if (!response.ok) {
    const message = payload.error?.message ?? `SiliconFlow request failed with status ${response.status}`;
    if (params.priorError instanceof Error) {
      throw new Error(`${params.priorError.message}; fallback request failed: ${message}`);
    }
    throw new Error(message);
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    if (params.priorError instanceof Error) {
      throw new Error(`${params.priorError.message}; fallback response did not include assistant content`);
    }
    throw new Error("SiliconFlow response did not include assistant content");
  }

  return content;
}
