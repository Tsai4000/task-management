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
  depends_on: string[];
  skills: string[];
  relevant_specs: string[];
  completion_notes: string;
  pr_link: string;
  worktree: string;
  objective: string;
  subtasks: string;
  impl_notes: string;
  status_log: StatusLogEntry[];
  created_at: string;
  started_at: string;
  completed_at: string;
  archived?: boolean;
}

export interface StatusLogEntry {
  date: string;
  message: string;
}

export type TaskRow = Omit<Task, 'depends_on' | 'skills' | 'relevant_specs' | 'status_log' | 'archived'> & {
  depends_on: string;
  skills: string;
  relevant_specs: string;
  status_log: string;
  archived: number;
};

export interface ListResult {
  tasks: Task[];
  total: number;
}
