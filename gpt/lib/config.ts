import { z } from "zod";

const EnvSchema = z.object({
  STAGE: z.string().min(1),
  REGION: z.string().min(1),
  STAFF_TABLE: z.string().min(1),
  JWT_SECRET_NAME: z.string().min(1),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default("30m"),
  JWT_KEY_CACHE_MS: z.string().default("300000")
});

export type Env = z.infer<typeof EnvSchema>;

export function env(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return parsed.data;
}
