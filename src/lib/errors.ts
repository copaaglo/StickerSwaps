// Maps Supabase / Postgres error codes to user-safe messages.
// Raw DB errors (table names, constraint names, etc.) must never
// reach the client.

const CODE_MAP: Record<string, string> = {
  '23505': 'That value is already taken.',
  '23514': 'The value you entered is not allowed.',
  '23503': 'This action references something that no longer exists.',
  '23502': 'A required field is missing.',
  '42501': 'You do not have permission to do that.',
  PGRST116: 'Record not found.',
  PGRST301: 'Your session has expired. Please sign in again.',
}

export function mapDbError(err: { code?: string; message?: string } | null | undefined): string {
  if (!err) return 'An unexpected error occurred.'
  if (err.code && CODE_MAP[err.code]) return CODE_MAP[err.code]
  // Supabase sometimes surfaces the Postgres message directly; scrub it
  return 'Something went wrong. Please try again.'
}
