import { createVisitorHandler } from './handler.ts'

// Comma-separated exact origins; a wildcard is never accepted.
const allowedOrigins = (Deno.env.get('JEV_ALLOWED_ORIGINS') ?? '').split(',').map(value => value.trim()).filter(Boolean)
Deno.serve(createVisitorHandler({ allowedOrigins }))

