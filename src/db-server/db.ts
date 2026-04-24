import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import type { Task, TaskRow } from '../shared/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
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
