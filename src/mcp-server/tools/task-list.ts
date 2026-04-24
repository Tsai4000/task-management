import { z } from 'zod';
import { dbListTasks } from '../db-client.js';

export const schema = {
  status:        z.enum(['pending', 'in_progress', 'done', 'blocked']).optional(),
  priority:      z.enum(['P0', 'P1', 'P2']).optional(),
  assigned_to:   z.enum(['claude', 'copilot', 'human']).optional(),
  show_archived: z.boolean().optional().describe('設為 true 以包含已封存的 task（預設隱藏）'),
  search:        z.string().optional().describe('搜尋關鍵字，比對標題、目標、實作備註'),
  page:          z.number().int().min(1).optional().describe('頁碼，從 1 開始（預設第 1 頁）'),
  page_size:     z.number().int().min(1).max(100).optional().describe('每頁筆數（預設 20）'),
};

export async function handler(args: z.infer<z.ZodObject<typeof schema>>) {
  const { tasks, total } = await dbListTasks(args);
  const page = args.page ?? 1;
  const page_size = args.page_size ?? 20;
  const totalPages = Math.ceil(total / page_size);

  const summary = tasks
    .map(t => {
      const archiveTag = t.archived ? ' [封存]' : '';
      return `${t.id}${archiveTag} [${t.status}] ${t.priority} ${t.title} → ${t.assigned_to}`;
    })
    .join('\n');

  const pageInfo = total > page_size
    ? `\n（第 ${page}/${totalPages} 頁，共 ${total} 筆）`
    : `\n（共 ${total} 筆）`;

  return {
    content: [{
      type: 'text' as const,
      text: summary ? `${summary}${pageInfo}` : `（無任何 task）`,
    }],
  };
}
