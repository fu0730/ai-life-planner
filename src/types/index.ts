export type TimeBlock = 'morning' | 'forenoon' | 'afternoon' | 'night';

export interface Category {
  id?: number;
  name: string;
  color: string;
  order: number;
  type: 'task' | 'routine' | 'checklist';
  parentId?: number;
}

export type ReminderType = 'morning' | 'day-before' | null;

export interface Task {
  id?: number;
  title: string;
  memo?: string;
  categoryId: number;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  startDate?: string;
  dueDate?: string;
  block?: TimeBlock;
  parentId?: number;
  isFolder?: boolean;
  calendarDisplay?: 'bar' | 'background';
  reminder?: ReminderType;
  order?: number;
  createdAt: string;
  completedAt?: string;
}

export interface Routine {
  id?: number;
  title: string;
  block: TimeBlock;
  startTime?: string;      // "07:00" 形式（任意）
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

export type TimeMode = 'fixed' | 'by-day' | 'ai';

export interface DaySchedule {
  wakeUpTime: string | null;  // null = AIお任せ
  bedTime: string | null;
}

export interface UserProfile {
  id?: number;
  wakeUpTime: string;       // "07:00" (fixedモード用 / デフォルト値)
  bedTime: string;          // "23:00"
  timeMode?: TimeMode;      // 'fixed' | 'by-day' | 'ai'
  daySchedules?: Record<number, DaySchedule>;  // 0=日〜6=土
  dreams?: string;          // やりたいこと・夢
  idealSelf?: string;       // なりたい自分
  createdAt: string;
}

export interface Settings {
  id?: number;
  theme: 'light' | 'dark';
  soundEnabled: boolean;
  sortBy: 'priority' | 'dueDate' | 'createdAt' | 'manual';
  viewMode: 'list' | 'grid';
  setupCompleted: boolean;
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  actions?: string; // AIAction[]のJSON文字列
  createdAt: string;
}

export type ListType = 'packing' | 'shopping';

export interface CheckList {
  id?: number;
  name: string;
  type: ListType;
  color: string;
  categoryId: number;
  order: number;
  createdAt: string;
}

export interface CheckListItem {
  id?: number;
  listId: number;
  title: string;
  checked: boolean;
  tags?: string[];
  order: number;
  createdAt: string;
  checkedAt?: string;
}

export interface PurchaseHistory {
  id?: number;
  listId: number;
  title: string;
  purchasedAt: string;
}
