import type { FastifyReply } from "fastify";

export function badRequest(reply: FastifyReply, message: string) {
  return reply.status(400).send({ error: message });
}

export function unauthorized(reply: FastifyReply, message = "Unauthorized") {
  return reply.status(401).send({ error: message });
}

export function forbidden(reply: FastifyReply, message = "Forbidden") {
  return reply.status(403).send({ error: message });
}

export function notFound(reply: FastifyReply, message = "Not found") {
  return reply.status(404).send({ error: message });
}

