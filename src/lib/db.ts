import Dexie, { type EntityTable } from 'dexie';
import type { Task, Category, DailyReflection, Settings, Routine, RoutineCompletion } from '@/types';

const db = new Dexie('LifePlannerDB') as Dexie & {
  tasks: EntityTable<Task, 'id'>;
  categories: EntityTable<Category, 'id'>;
  reflections: EntityTable<DailyReflection, 'id'>;
  settings: EntityTable<Settings, 'id'>;
  routines: EntityTable<Routine, 'id'>;
  routineCompletions: EntityTable<RoutineCompletion, 'id'>;
};

db.version(1).stores({
  tasks: '++id, categoryId, completed, dueDate, createdAt',
  categories: '++id, name, order, type',
});

db.version(2).stores({
  tasks: '++id, categoryId, completed, dueDate, createdAt, completedAt',
  categories: '++id, name, order, type',
  reflections: '++id, date',
  settings: '++id',
});

db.version(3).stores({
  tasks: '++id, categoryId, completed, dueDate, createdAt, completedAt, block',
  categories: '++id, name, order, type',
  reflections: '++id, date',
  settings: '++id',
  routines: '++id, block, order',
  routineCompletions: '++id, routineId, date, [routineId+date]',
});

export { db };
