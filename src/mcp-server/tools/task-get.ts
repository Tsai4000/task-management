import { z } from 'zod';
import { dbGetTask } from '../db-client.js';

export const schema = {
  task_id: z.string().describe('Task ID，例如 TASK-001'),
};

export async function handler(args: { task_id: string }) {
  const task = await dbGetTask(args.task_id);
  if (!task) {
    return { content: [{ type: 'text' as const, text: `找不到 ${args.task_id}` }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] };
}
