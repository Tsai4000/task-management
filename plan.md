# Task MCP Server — 完整實作規格

## 架構概覽

多人共用的 AI Agent Task 管理伺服器。MCP Server + SQLite DB 部署在 VM，
所有開發者的 Claude Code 透過 HTTP SSE URL 連線共用同一個 server。

```
[Dev A Claude Code] ──HTTP SSE──┐
[Dev B Claude Code] ──HTTP SSE──┤──► [VM: Express + MCP SSE Server :3333] ──► SQLite tasks.db
[Dev C Claude Code] ──HTTP SSE──┘
```

---

## 目錄結構

```
task-mcp-server/          ← 新專案根目錄
├── src/
│   ├── index.ts          # HTTP server 進入點（Express + SSE）
│   ├── mcp-server.ts     # McpServer 建立與 tools 註冊
│   ├── db.ts             # SQLite 初始化與 CRUD helpers
│   ├── types.ts          # Task interface、Status/Priority enum
│   ├── id-generator.ts   # 自動產生 TASK-001 格式 ID
│   └── tools/
│       ├── index.ts      # 所有 tools export
│       ├── task-create.ts
│       ├── task-get.ts
│       ├── task-list.ts
│       ├── task-update.ts
│       ├── task-dispatch.ts
│       ├── task-complete.ts
│       └── task-deps-check.ts
├── data/                 # DB 檔案（gitignore）
│   └── tasks.db
├── package.json
├── tsconfig.json
└── .gitignore
```

---

## package.json

```json
{
  "name": "task-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.10.0",
    "better-sqlite3": "^11.0.0",
    "express": "^4.19.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/express": "^4.17.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0"
  }
}
```

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

---

## .gitignore

```
node_modules/
dist/
data/
*.db
.env
```

---

## src/types.ts

```typescript
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';
export type TaskPriority = 'P0' | 'P1' | 'P2';
export type AssignedTo = 'claude' | 'copilot' | 'human';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: AssignedTo;
  branch: string;
  base_branch: string;
  depends_on: string[];      // TASK-IDs
  skills: string[];          // skill names
  relevant_specs: string[];  // file paths
  completion_notes: string;
  pr_link: string;
  worktree: string;
  objective: string;
  subtasks: string;          // Markdown
  impl_notes: string;
  status_log: StatusLogEntry[];
  created_at: string;
  started_at: string;
  completed_at: string;
}

export interface StatusLogEntry {
  date: string;
  message: string;
}

export type TaskRow = Omit<Task, 'depends_on' | 'skills' | 'relevant_specs' | 'status_log'> & {
  depends_on: string;     // JSON string
  skills: string;         // JSON string
  relevant_specs: string; // JSON string
  status_log: string;     // JSON string
};
```

---

## src/db.ts

```typescript
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import type { Task, TaskRow } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'tasks.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id               TEXT PRIMARY KEY,
    title            TEXT NOT NULL,
    status           TEXT DEFAULT 'pending',
    priority         TEXT DEFAULT 'P1',
    assigned_to      TEXT DEFAULT 'claude',
    branch           TEXT DEFAULT '',
    base_branch      TEXT DEFAULT '',
    depends_on       TEXT DEFAULT '[]',
    skills           TEXT DEFAULT '[]',
    relevant_specs   TEXT DEFAULT '[]',
    completion_notes TEXT DEFAULT '',
    pr_link          TEXT DEFAULT '',
    worktree         TEXT DEFAULT '',
    objective        TEXT DEFAULT '',
    subtasks         TEXT DEFAULT '',
    impl_notes       TEXT DEFAULT '',
    status_log       TEXT DEFAULT '[]',
    created_at       TEXT NOT NULL,
    started_at       TEXT DEFAULT '',
    completed_at     TEXT DEFAULT ''
  );
`);

function deserialize(row: TaskRow): Task {
  return {
    ...row,
    depends_on: JSON.parse(row.depends_on),
    skills: JSON.parse(row.skills),
    relevant_specs: JSON.parse(row.relevant_specs),
    status_log: JSON.parse(row.status_log),
  };
}

export function dbGetTask(id: string): Task | undefined {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
  return row ? deserialize(row) : undefined;
}

export function dbListTasks(
  filters: { status?: string; priority?: string; assigned_to?: string } = {}
): Task[] {
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params: string[] = [];
  if (filters.status)      { query += ' AND status = ?';      params.push(filters.status); }
  if (filters.priority)    { query += ' AND priority = ?';    params.push(filters.priority); }
  if (filters.assigned_to) { query += ' AND assigned_to = ?'; params.push(filters.assigned_to); }
  query += ' ORDER BY created_at DESC';
  const rows = db.prepare(query).all(...params) as TaskRow[];
  return rows.map(deserialize);
}

export function dbInsertTask(task: Task): void {
  db.prepare(`
    INSERT INTO tasks (id, title, status, priority, assigned_to, branch, base_branch,
      depends_on, skills, relevant_specs, completion_notes, pr_link, worktree,
      objective, subtasks, impl_notes, status_log, created_at, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.id, task.title, task.status, task.priority, task.assigned_to,
    task.branch, task.base_branch,
    JSON.stringify(task.depends_on), JSON.stringify(task.skills),
    JSON.stringify(task.relevant_specs), task.completion_notes,
    task.pr_link, task.worktree, task.objective, task.subtasks,
    task.impl_notes, JSON.stringify(task.status_log),
    task.created_at, task.started_at, task.completed_at
  );
}

export function dbUpdateTask(id: string, fields: Partial<Task>): void {
  const serialized: Record<string, unknown> = { ...fields };
  if (fields.depends_on)     serialized.depends_on     = JSON.stringify(fields.depends_on);
  if (fields.skills)         serialized.skills          = JSON.stringify(fields.skills);
  if (fields.relevant_specs) serialized.relevant_specs  = JSON.stringify(fields.relevant_specs);
  if (fields.status_log)     serialized.status_log      = JSON.stringify(fields.status_log);

  const keys = Object.keys(serialized);
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE tasks SET ${setClause} WHERE id = ?`).run(...Object.values(serialized), id);
}

export function dbGetMaxId(): number {
  const row = db
    .prepare('SELECT MAX(CAST(SUBSTR(id, 6) AS INTEGER)) AS max_num FROM tasks')
    .get() as { max_num: number | null };
  return row.max_num ?? 0;
}
```

---

## src/id-generator.ts

```typescript
import { dbGetMaxId } from './db.js';

export function generateTaskId(): string {
  const next = dbGetMaxId() + 1;
  return `TASK-${String(next).padStart(3, '0')}`;
}
```

---

## src/tools/task-create.ts

```typescript
import { z } from 'zod';
import { dbInsertTask } from '../db.js';
import { generateTaskId } from '../id-generator.js';
import type { Task } from '../types.js';

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
  const id = generateTaskId();
  const now = new Date().toISOString().split('T')[0];
  const task: Task = {
    id,
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
  };
  dbInsertTask(task);
  return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] };
}
```

---

## src/tools/task-get.ts

```typescript
import { z } from 'zod';
import { dbGetTask } from '../db.js';

export const schema = {
  task_id: z.string().describe('Task ID，例如 TASK-001'),
};

export async function handler(args: { task_id: string }) {
  const task = dbGetTask(args.task_id);
  if (!task) {
    return { content: [{ type: 'text' as const, text: `找不到 ${args.task_id}` }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] };
}
```

---

## src/tools/task-list.ts

```typescript
import { z } from 'zod';
import { dbListTasks } from '../db.js';

export const schema = {
  status:      z.enum(['pending', 'in_progress', 'done', 'blocked']).optional(),
  priority:    z.enum(['P0', 'P1', 'P2']).optional(),
  assigned_to: z.enum(['claude', 'copilot', 'human']).optional(),
};

export async function handler(args: z.infer<z.ZodObject<typeof schema>>) {
  const tasks = dbListTasks(args);
  const summary = tasks
    .map(t => `${t.id} [${t.status}] ${t.priority} ${t.title} → ${t.assigned_to}`)
    .join('\n');
  return { content: [{ type: 'text' as const, text: summary || '（無任何 task）' }] };
}
```

---

## src/tools/task-update.ts

```typescript
import { z } from 'zod';
import { dbUpdateTask } from '../db.js';

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

export async function handler(args: { task_id: string; fields: Record<string, unknown> }) {
  dbUpdateTask(args.task_id, args.fields as Parameters<typeof dbUpdateTask>[1]);
  return { content: [{ type: 'text' as const, text: `${args.task_id} 已更新` }] };
}
```

---

## src/tools/task-dispatch.ts

```typescript
import { z } from 'zod';
import { dbGetTask, dbUpdateTask } from '../db.js';

export const schema = {
  task_id: z.string(),
};

export async function handler(args: { task_id: string }) {
  const task = dbGetTask(args.task_id);
  if (!task) {
    return { content: [{ type: 'text' as const, text: `找不到 ${args.task_id}` }] };
  }
  if (task.status !== 'pending') {
    return { content: [{ type: 'text' as const, text: `${args.task_id} 目前狀態為 ${task.status}，無法分派` }] };
  }
  const now = new Date().toISOString().split('T')[0];
  const newLog = [...task.status_log, { date: now, message: `已分派給 ${task.assigned_to}` }];
  dbUpdateTask(args.task_id, { status: 'in_progress', started_at: now, status_log: newLog });
  return { content: [{ type: 'text' as const, text: `${args.task_id} 已分派，status → in_progress` }] };
}
```

---

## src/tools/task-complete.ts

```typescript
import { z } from 'zod';
import { dbGetTask, dbUpdateTask } from '../db.js';

export const schema = {
  task_id:          z.string(),
  completion_notes: z.string().describe('完成摘要，後置 task 需要的輸出資訊'),
};

export async function handler(args: { task_id: string; completion_notes: string }) {
  const task = dbGetTask(args.task_id);
  if (!task) {
    return { content: [{ type: 'text' as const, text: `找不到 ${args.task_id}` }] };
  }
  const now = new Date().toISOString().split('T')[0];
  const newLog = [...task.status_log, { date: now, message: '所有 subtask 完成，等待 Review' }];
  dbUpdateTask(args.task_id, {
    status: 'done',
    completed_at: now,
    completion_notes: args.completion_notes,
    status_log: newLog,
  });
  return { content: [{ type: 'text' as const, text: `${args.task_id} 已標記完成` }] };
}
```

---

## src/tools/task-deps-check.ts

```typescript
import { z } from 'zod';
import { dbGetTask } from '../db.js';

export const schema = {
  task_id: z.string(),
};

export async function handler(args: { task_id: string }) {
  const task = dbGetTask(args.task_id);
  if (!task) {
    return { content: [{ type: 'text' as const, text: `找不到 ${args.task_id}` }] };
  }
  const blocked = task.depends_on
    .map(depId => ({ id: depId, dep: dbGetTask(depId) }))
    .filter(({ dep }) => !dep || dep.status !== 'done')
    .map(({ id, dep }) => `${id}（${dep ? dep.status : '不存在'}）`);

  if (blocked.length === 0) {
    return { content: [{ type: 'text' as const, text: `${args.task_id} 的所有前置任務已完成，可以分派` }] };
  }
  return { content: [{ type: 'text' as const, text: `尚未完成的前置任務：\n${blocked.join('\n')}` }] };
}
```

---

## src/tools/index.ts

```typescript
export * as taskCreate    from './task-create.js';
export * as taskGet       from './task-get.js';
export * as taskList      from './task-list.js';
export * as taskUpdate    from './task-update.js';
export * as taskDispatch  from './task-dispatch.js';
export * as taskComplete  from './task-complete.js';
export * as taskDepsCheck from './task-deps-check.js';
```

---

## src/mcp-server.ts

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as tools from './tools/index.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'task-server', version: '1.0.0' });

  server.tool('task_create',     tools.taskCreate.schema,    tools.taskCreate.handler);
  server.tool('task_get',        tools.taskGet.schema,        tools.taskGet.handler);
  server.tool('task_list',       tools.taskList.schema,       tools.taskList.handler);
  server.tool('task_update',     tools.taskUpdate.schema,     tools.taskUpdate.handler);
  server.tool('task_dispatch',   tools.taskDispatch.schema,   tools.taskDispatch.handler);
  server.tool('task_complete',   tools.taskComplete.schema,   tools.taskComplete.handler);
  server.tool('task_deps_check', tools.taskDepsCheck.schema,  tools.taskDepsCheck.handler);

  return server;
}
```

---

## src/index.ts（HTTP SSE Server）

```typescript
import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMcpServer } from './mcp-server.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3333;
const API_KEY = process.env.API_KEY ?? '';

const transports = new Map<string, SSEServerTransport>();

app.get('/sse', async (req, res) => {
  if (API_KEY) {
    const auth = (req.headers.authorization ?? req.query['key']) as string;
    if (auth !== `Bearer ${API_KEY}` && auth !== API_KEY) {
      res.status(401).send('Unauthorized');
      return;
    }
  }

  const transport = new SSEServerTransport('/message', res);
  transports.set(transport.sessionId, transport);
  res.on('close', () => transports.delete(transport.sessionId));

  const server = createMcpServer();
  await server.connect(transport);
});

app.post('/message', async (req, res) => {
  const sessionId = req.query['sessionId'] as string;
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).send('Session not found');
    return;
  }
  await transport.handlePostMessage(req, res);
});

app.listen(PORT, () => {
  console.log(`Task MCP Server running on http://0.0.0.0:${PORT}`);
  console.log(`SSE endpoint: http://0.0.0.0:${PORT}/sse`);
});
```

---

## Claude Code 連線設定

```json
// 各開發者的 .claude/settings.local.json（不進 git）
{
  "mcpServers": {
    "task-server": {
      "url": "http://<vm-ip>:3333/sse"
    }
  }
}
```

若有 API Key：

```json
{
  "mcpServers": {
    "task-server": {
      "url": "http://<vm-ip>:3333/sse?key=<API_KEY>"
    }
  }
}
```

---

## VM 部署指令（pm2）

```bash
# 安裝依賴並編譯
npm install && npm run build

# 用 pm2 常駐執行
PORT=3333 API_KEY=your-secret npx pm2 start dist/index.js --name task-server
npx pm2 save
npx pm2 startup

# 確認狀態
npx pm2 list
curl http://localhost:3333/sse
```

---

## 驗證步驟

1. `npm install && npm run build`（無編譯錯誤）
2. `node dist/index.js`（本地跑，看到 "running on :3333"）
3. 設定 `.claude/settings.local.json`，重啟 Claude Code
4. 執行 `/mcp`，確認 `task-server` 狀態為 **connected**
5. 呼叫 `task_create({ title: "測試 task" })` → 回傳 `{ id: "TASK-001", ... }`
6. 呼叫 `task_list({})` → 看到 TASK-001
7. 呼叫 `task_dispatch({ task_id: "TASK-001" })` → status → in_progress
8. 呼叫 `task_complete({ task_id: "TASK-001", completion_notes: "done" })` → status → done
