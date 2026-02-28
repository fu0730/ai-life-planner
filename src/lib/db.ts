import Dexie, { type EntityTable } from 'dexie';
import type { Task, Category } from '@/types';

const db = new Dexie('LifePlannerDB') as Dexie & {
  tasks: EntityTable<Task, 'id'>;
  categories: EntityTable<Category, 'id'>;
};

db.version(1).stores({
  tasks: '++id, categoryId, completed, dueDate, createdAt',
  categories: '++id, name, order, type',
});

export { db };
