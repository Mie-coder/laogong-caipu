import { z } from "zod";

export const ApiErrorResponseSchema = z.union([z.object({ error: z.object({ code: z.string(), message: z.string() }) }), z.object({ error: z.string() })]);
export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) { super(message); }
}
