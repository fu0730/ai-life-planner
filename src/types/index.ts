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
  createdAt: string;
  completedAt?: string;
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
