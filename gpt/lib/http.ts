import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { ApiError, Errors } from "./errors.js";

export function getCorrelationId(event: APIGatewayProxyEventV2): string {
  return (
    event.headers?.["x-correlation-id"] ??
    event.headers?.["X-Correlation-Id"] ??
    event.requestContext?.requestId ??
    (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
  );
}

export function json(statusCode: number, body: unknown, extraHeaders?: Record<string, string>): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

export function parseJsonBody<T>(event: APIGatewayProxyEventV2, schema: z.ZodSchema<T>): T {
  if (!event.body) throw Errors.validation("Missing request body");
  let parsed: unknown;
  try {
    const s = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    parsed = JSON.parse(s);
  } catch {
    throw Errors.validation("Invalid JSON body");
  }
  const res = schema.safeParse(parsed);
  if (!res.success) throw Errors.validation("Invalid request body", res.error.flatten());
  return res.data;
}

export function toErrorResponse(err: unknown, requestId: string): APIGatewayProxyResultV2 {
  const e = err instanceof ApiError ? err : Errors.internal();
  return json(e.statusCode, {
    error: {
      code: e.code,
      message: e.message,
      requestId,
      details: e.code === "ValidationError" ? e.details : undefined
    }
  }, { "x-correlation-id": requestId });
}
