import type { Task } from '../shared/types.js';

const DB_URL = (process.env.DB_SERVER_URL ?? 'http://localhost:3334').replace(/\/$/, '');

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${DB_URL}${path}`, init);
}

export async function dbGetTask(id: string): Promise<Task | undefined> {
  const res = await apiFetch(`/tasks/${id}`);
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`DB Server error ${res.status}`);
  return res.json() as Promise<Task>;
}

export async function dbListTasks(
  filters: { status?: string; priority?: string; assigned_to?: string } = {}
): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters.status)      params.set('status', filters.status);
  if (filters.priority)    params.set('priority', filters.priority);
  if (filters.assigned_to) params.set('assigned_to', filters.assigned_to);
  const qs = params.toString();
  const res = await apiFetch(`/tasks${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(`DB Server error ${res.status}`);
  return res.json() as Promise<Task[]>;
}

export async function dbInsertTask(data: Omit<Task, 'id'>): Promise<Task> {
  const res = await apiFetch('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`DB Server error ${res.status}`);
  return res.json() as Promise<Task>;
}

export async function dbUpdateTask(id: string, fields: Partial<Task>): Promise<void> {
  const res = await apiFetch(`/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`DB Server error ${res.status}`);
}
