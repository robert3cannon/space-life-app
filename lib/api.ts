import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isAuthedRequest, isBotRequest, isHealthRequest } from "./auth";
import { HttpError } from "./errors";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    throw new HttpError("Expected a JSON body", 400);
  }
}

export function fromError(err: unknown) {
  if (err instanceof ZodError) {
    const message = err.issues
      .map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      })
      .join("; ");
    return error(message || "Invalid request", 400);
  }
  if (err instanceof HttpError) return error(err.message, err.status);
  const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
  if (code === "23514" || code === "23502") return error("That didn't pass a check", 400);
  console.error("api_error", err instanceof Error ? err.message : err);
  return error("Something went wrong", 500);
}

export function withUser<C>(handler: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try {
      if (!(await isAuthedRequest(req))) return error("Unauthorized", 401);
      return await handler(req, ctx);
    } catch (err) {
      return fromError(err);
    }
  };
}

export function withHealth<C>(handler: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try {
      if (!(await isHealthRequest(req))) return error("Unauthorized", 401);
      return await handler(req, ctx);
    } catch (err) {
      return fromError(err);
    }
  };
}

export function withBot<C>(handler: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try {
      if (!isBotRequest(req)) return error("Unauthorized", 401);
      return await handler(req, ctx);
    } catch (err) {
      return fromError(err);
    }
  };
}
