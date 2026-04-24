import { z } from 'zod';
import { dbListTasks } from '../db-client.js';

export const schema = {
  status:      z.enum(['pending', 'in_progress', 'done', 'blocked']).optional(),
  priority:    z.enum(['P0', 'P1', 'P2']).optional(),
  assigned_to: z.enum(['claude', 'copilot', 'human']).optional(),
};

export async function handler(args: z.infer<z.ZodObject<typeof schema>>) {
  const tasks = await dbListTasks(args);
  const summary = tasks
    .map(t => `${t.id} [${t.status}] ${t.priority} ${t.title} → ${t.assigned_to}`)
    .join('\n');
  return { content: [{ type: 'text' as const, text: summary || '（無任何 task）' }] };
}
