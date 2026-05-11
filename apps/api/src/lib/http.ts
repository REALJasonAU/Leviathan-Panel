import type { FastifyRequest } from "fastify";
import type { z } from "zod";

export const parseBody = <TSchema extends z.ZodTypeAny>(
  request: FastifyRequest,
  schema: TSchema,
): z.infer<TSchema> => schema.parse(request.body);

export const parseParams = <TSchema extends z.ZodTypeAny>(
  request: FastifyRequest,
  schema: TSchema,
): z.infer<TSchema> => schema.parse(request.params);

export const parseQuery = <TSchema extends z.ZodTypeAny>(
  request: FastifyRequest,
  schema: TSchema,
): z.infer<TSchema> => schema.parse(request.query);
