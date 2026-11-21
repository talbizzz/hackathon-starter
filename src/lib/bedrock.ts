// Amazon Bedrock via the Converse API, using a Bedrock API key (bearer token).
// Plain fetch, so it runs on Cloudflare Workers (no AWS SDK, no SigV4).
// Works with any Bedrock chat model ID (Claude, GPT, Grok, Llama, Mistral...).

type Msg = { role: "user" | "assistant"; content: { text: string }[] };

export async function bedrockConverse(opts: {
  token: string;
  region: string;
  modelId: string;
  messages: Msg[];
  system?: string;
  maxTokens?: number;
}): Promise<string> {
  const url = `https://bedrock-runtime.${opts.region}.amazonaws.com/model/${encodeURIComponent(opts.modelId)}/converse`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: opts.messages,
      ...(opts.system ? { system: [{ text: opts.system }] } : {}),
      inferenceConfig: { maxTokens: opts.maxTokens ?? 1024 },
    }),
  });
  if (!res.ok) throw new Error(`Bedrock ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { output?: { message?: { content?: { text?: string }[] } } };
  return (data.output?.message?.content ?? []).map((c) => c.text ?? "").join("");
}
