import { z } from 'zod';
import { dbInsertTask } from '../db-client.js';

export const schema = {
  title:          z.string().describe('任務標題'),
  priority:       z.enum(['P0', 'P1', 'P2']).optional().default('P1'),
  assigned_to:    z.enum(['claude', 'copilot', 'human']).optional().default('claude'),
  branch:         z.string().optional().default(''),
  base_branch:    z.string().optional().default(''),
  depends_on:     z.array(z.string()).optional().default([]),
  skills:         z.array(z.string()).optional().default([]),
  relevant_specs: z.array(z.string()).optional().default([]),
  objective:      z.string().optional().default(''),
  subtasks:       z.string().optional().default(''),
  impl_notes:     z.string().optional().default(''),
};

export async function handler(args: z.infer<z.ZodObject<typeof schema>>) {
  const now = new Date().toISOString().split('T')[0];
  const task = await dbInsertTask({
    title: args.title,
    status: 'pending',
    priority: args.priority,
    assigned_to: args.assigned_to,
    branch: args.branch ?? '',
    base_branch: args.base_branch ?? '',
    depends_on: args.depends_on ?? [],
    skills: args.skills ?? [],
    relevant_specs: args.relevant_specs ?? [],
    completion_notes: '',
    pr_link: '',
    worktree: '',
    objective: args.objective ?? '',
    subtasks: args.subtasks ?? '',
    impl_notes: args.impl_notes ?? '',
    status_log: [{ date: now, message: '已建立 task 卡' }],
    created_at: now,
    started_at: '',
    completed_at: '',
  });
  return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] };
}
