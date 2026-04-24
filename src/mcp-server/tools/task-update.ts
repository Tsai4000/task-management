import { z } from 'zod';
import { dbUpdateTask } from '../db-client.js';
import type { Task } from '../../shared/types.js';

export const schema = {
  task_id: z.string(),
  fields: z.object({
    title:            z.string().optional(),
    status:           z.enum(['pending', 'in_progress', 'done', 'blocked']).optional(),
    priority:         z.enum(['P0', 'P1', 'P2']).optional(),
    assigned_to:      z.enum(['claude', 'copilot', 'human']).optional(),
    branch:           z.string().optional(),
    base_branch:      z.string().optional(),
    depends_on:       z.array(z.string()).optional(),
    skills:           z.array(z.string()).optional(),
    completion_notes: z.string().optional(),
    pr_link:          z.string().optional(),
    worktree:         z.string().optional(),
    objective:        z.string().optional(),
    subtasks:         z.string().optional(),
    impl_notes:       z.string().optional(),
  }),
};

export async function handler(args: { task_id: string; fields: Partial<Task> }) {
  await dbUpdateTask(args.task_id, args.fields);
  return { content: [{ type: 'text' as const, text: `${args.task_id} 已更新` }] };
}
