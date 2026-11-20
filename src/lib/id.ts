import type { ID } from '../db/schema';

export function newId(): ID {
  return crypto.randomUUID();
}
