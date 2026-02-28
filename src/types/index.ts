export type TimeBlock = 'morning' | 'forenoon' | 'afternoon' | 'night';

export interface Category {
  id?: number;
  name: string;
  color: string;
  order: number;
  type: 'task' | 'routine' | 'checklist';
}

export interface Task {
  id?: number;
  title: string;
  memo?: string;
  categoryId: number;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  block?: TimeBlock;
  createdAt: string;
  completedAt?: string;
}

export interface Routine {
  id?: number;
  title: string;
  block: TimeBlock;
  estimatedMinutes?: number;
  days: number[];          // [0=日, 1=月, ... 6=土]
  order: number;
  createdAt: string;
}

export interface RoutineCompletion {
  id?: number;
  routineId: number;
  date: string;            // "2026-03-01"
  completedAt: string;
}

export interface DailyReflection {
  id?: number;
  date: string;
  completedCount: number;
  totalCount: number;
  note?: string;
  createdAt: string;
}

export interface Settings {
  id?: number;
  theme: 'light' | 'dark';
  soundEnabled: boolean;
  sortBy: 'priority' | 'dueDate' | 'createdAt';
}
