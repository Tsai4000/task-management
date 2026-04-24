import express from 'express';
import { dbGetTask, dbListTasks, dbInsertTask, dbUpdateTask } from './db.js';
import { generateTaskId } from './id-generator.js';
import type { Task } from '../shared/types.js';

const app = express();
app.use(express.json());

const PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3334;

app.get('/tasks', (req, res) => {
  const { status, priority, assigned_to } = req.query;
  const tasks = dbListTasks({
    status: status as string | undefined,
    priority: priority as string | undefined,
    assigned_to: assigned_to as string | undefined,
  });
  res.json(tasks);
});

app.get('/tasks/:id', (req, res) => {
  const task = dbGetTask(req.params.id);
  if (!task) {
    res.status(404).json({ error: `找不到 ${req.params.id}` });
    return;
  }
  res.json(task);
});

app.post('/tasks', (req, res) => {
  const id = generateTaskId();
  const task: Task = { id, ...req.body };
  dbInsertTask(task);
  res.status(201).json(task);
});

app.patch('/tasks/:id', (req, res) => {
  dbUpdateTask(req.params.id, req.body);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`DB Server running on http://0.0.0.0:${PORT}`);
});
