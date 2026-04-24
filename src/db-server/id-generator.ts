import { dbGetMaxId } from './db.js';

export function generateTaskId(): string {
  const next = dbGetMaxId() + 1;
  return `TASK-${String(next).padStart(3, '0')}`;
}
