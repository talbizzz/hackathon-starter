import { z } from "zod";

// NEXT_PUBLIC_* must be referenced literally so Next can inline them in the browser bundle.
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default("https://eu.i.posthog.com"),
});

const serverSchema = z.object({
  AI_PROVIDER: z.enum(["anthropic", "openai"]).default("anthropic"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5-5"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
});

function fail(error: z.ZodError): never {
  const lines = error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
  throw new Error(
    `\n\nInvalid environment variables:\n${lines.join("\n")}\n\nSee .env.example and README.\n`,
  );
}

const publicParsed = publicSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
});
if (!publicParsed.success) fail(publicParsed.error);

/** Safe in client and server code. */
export const env = publicParsed.data;

/** Server only. Call inside a request handler, never at module top level of client code. */
export function serverEnv() {
  if (typeof window !== "undefined") throw new Error("serverEnv() called in the browser");
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) fail(parsed.error);
  return parsed.data;
}
