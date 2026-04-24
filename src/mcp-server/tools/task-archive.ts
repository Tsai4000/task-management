import { z } from 'zod';
import { dbUpdateTask, dbGetTask } from '../db-client.js';

export const schema = {
  task_id: z.string().describe('要封存的 task ID，例如 TASK-001'),
};

export async function handler(args: z.infer<z.ZodObject<typeof schema>>) {
  const task = await dbGetTask(args.task_id);
  if (!task) {
    return { content: [{ type: 'text' as const, text: `找不到 ${args.task_id}` }] };
  }
  await dbUpdateTask(args.task_id, { archived: true });
  return { content: [{ type: 'text' as const, text: `${args.task_id} 已封存，之後 task_list 預設不會顯示此 task（可加上 show_archived: true 查看）` }] };
}
