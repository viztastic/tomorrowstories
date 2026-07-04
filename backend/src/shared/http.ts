import type { APIGatewayProxyResultV2 } from "aws-lambda";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-admin-key",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

export function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json", ...CORS },
    body: JSON.stringify(body),
  };
}

export const ok = (body: unknown) => json(200, body);
export const created = (body: unknown) => json(201, body);
export const badRequest = (msg: string) => json(400, { error: msg });
export const notFound = (msg = "Not found") => json(404, { error: msg });
export const serverError = (msg = "Internal error") => json(500, { error: msg });

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
