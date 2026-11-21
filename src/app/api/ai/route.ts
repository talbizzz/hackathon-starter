import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { bedrockConverse } from "@/lib/bedrock";

// POST /api/ai  body: { prompt: string }  -> streams plain text.
// Provider is chosen with AI_PROVIDER (anthropic | openai | bedrock). Keys never leave the server.
// Requires a signed-in user so credits can't be drained by strangers.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return new Response("Unauthorized", { status: 401 });

  const { prompt } = (await req.json().catch(() => ({}))) as { prompt?: string };
  if (!prompt || typeof prompt !== "string" || prompt.length > 8000) {
    return new Response("Invalid prompt", { status: 400 });
  }

  const e = serverEnv();
  const encoder = new TextEncoder();

  try {
    if (e.AI_PROVIDER === "bedrock") {
      if (!e.AWS_BEARER_TOKEN_BEDROCK) return new Response("AWS_BEARER_TOKEN_BEDROCK not set", { status: 500 });
      if (!e.BEDROCK_MODEL) return new Response("BEDROCK_MODEL not set", { status: 500 });
      const text = await bedrockConverse({
        token: e.AWS_BEARER_TOKEN_BEDROCK,
        region: e.AWS_REGION,
        modelId: e.BEDROCK_MODEL,
        messages: [{ role: "user", content: [{ text: prompt }] }],
      });
      return streamText(async (send) => send(text));
    }

    if (e.AI_PROVIDER === "openai") {
      if (!e.OPENAI_API_KEY) return new Response("OPENAI_API_KEY not set", { status: 500 });
      const openai = new OpenAI({ apiKey: e.OPENAI_API_KEY });
      const stream = await openai.chat.completions.create({
        model: e.OPENAI_MODEL,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      });
      return streamText(async (send) => {
        for await (const chunk of stream) send(chunk.choices[0]?.delta?.content ?? "");
      });
    }

    if (!e.ANTHROPIC_API_KEY) return new Response("ANTHROPIC_API_KEY not set", { status: 500 });
    const anthropic = new Anthropic({ apiKey: e.ANTHROPIC_API_KEY });
    const stream = anthropic.messages.stream({
      model: e.ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    return streamText(async (send) => {
      for await (const ev of stream) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") send(ev.delta.text);
      }
    });
  } catch (err) {
    console.error("ai route error", err);
    return new Response("AI provider error", { status: 502 });
  }

  function streamText(run: (send: (t: string) => void) => Promise<void>) {
    const body = new ReadableStream({
      async start(controller) {
        try {
          await run((t) => t && controller.enqueue(encoder.encode(t)));
        } catch (err) {
          console.error("ai stream error", err);
        } finally {
          controller.close();
        }
      },
    });
    return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
}
