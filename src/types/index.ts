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
