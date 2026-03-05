import Dexie, { type EntityTable } from 'dexie';
import type { Task, Category, DailyReflection, Settings, Routine, RoutineCompletion, UserProfile, ChatMessage, CheckList, CheckListItem, PurchaseHistory } from '@/types';

const db = new Dexie('LifePlannerDB') as Dexie & {
  tasks: EntityTable<Task, 'id'>;
  categories: EntityTable<Category, 'id'>;
  reflections: EntityTable<DailyReflection, 'id'>;
  settings: EntityTable<Settings, 'id'>;
  routines: EntityTable<Routine, 'id'>;
  routineCompletions: EntityTable<RoutineCompletion, 'id'>;
  userProfile: EntityTable<UserProfile, 'id'>;
  chatMessages: EntityTable<ChatMessage, 'id'>;
  checkLists: EntityTable<CheckList, 'id'>;
  checkListItems: EntityTable<CheckListItem, 'id'>;
  purchaseHistory: EntityTable<PurchaseHistory, 'id'>;
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

db.version(4).stores({
  tasks: '++id, categoryId, completed, dueDate, createdAt, completedAt, block',
  categories: '++id, name, order, type',
  reflections: '++id, date',
  settings: '++id',
  routines: '++id, block, order',
  routineCompletions: '++id, routineId, date, [routineId+date]',
  userProfile: '++id',
}).upgrade(tx => {
  return tx.table('settings').toCollection().modify(settings => {
    if (settings.setupCompleted === undefined) {
      settings.setupCompleted = true; // 既存ユーザーはセットアップ済み扱い
    }
  });
});

db.version(5).stores({
  tasks: '++id, categoryId, completed, dueDate, createdAt, completedAt, block',
  categories: '++id, name, order, type',
  reflections: '++id, date',
  settings: '++id',
  routines: '++id, block, order',
  routineCompletions: '++id, routineId, date, [routineId+date]',
  userProfile: '++id',
  chatMessages: '++id, createdAt',
});

db.version(6).stores({
  tasks: '++id, categoryId, completed, dueDate, createdAt, completedAt, block, parentId',
  categories: '++id, name, order, type',
  reflections: '++id, date',
  settings: '++id',
  routines: '++id, block, order',
  routineCompletions: '++id, routineId, date, [routineId+date]',
  userProfile: '++id',
  chatMessages: '++id, createdAt',
});

db.version(7).stores({
  tasks: '++id, categoryId, completed, dueDate, createdAt, completedAt, block, parentId, startDate',
  categories: '++id, name, order, type',
  reflections: '++id, date',
  settings: '++id',
  routines: '++id, block, order',
  routineCompletions: '++id, routineId, date, [routineId+date]',
  userProfile: '++id',
  chatMessages: '++id, createdAt',
});

db.version(8).stores({
  tasks: '++id, categoryId, completed, dueDate, createdAt, completedAt, block, parentId, startDate, calendarDisplay',
  categories: '++id, name, order, type',
  reflections: '++id, date',
  settings: '++id',
  routines: '++id, block, order',
  routineCompletions: '++id, routineId, date, [routineId+date]',
  userProfile: '++id',
  chatMessages: '++id, createdAt',
});

db.version(9).stores({
  tasks: '++id, categoryId, completed, dueDate, createdAt, completedAt, block, parentId, startDate, calendarDisplay',
  categories: '++id, name, order, type, parentId',
  reflections: '++id, date',
  settings: '++id',
  routines: '++id, block, order',
  routineCompletions: '++id, routineId, date, [routineId+date]',
  userProfile: '++id',
  chatMessages: '++id, createdAt',
});

db.version(10).stores({
  tasks: '++id, categoryId, completed, dueDate, createdAt, completedAt, block, parentId, startDate, calendarDisplay, isFolder',
  categories: '++id, name, order, type, parentId',
  reflections: '++id, date',
  settings: '++id',
  routines: '++id, block, order',
  routineCompletions: '++id, routineId, date, [routineId+date]',
  userProfile: '++id',
  chatMessages: '++id, createdAt',
});

db.version(11).stores({
  tasks: '++id, categoryId, completed, dueDate, createdAt, completedAt, block, parentId, startDate, calendarDisplay, isFolder',
  categories: '++id, name, order, type, parentId',
  reflections: '++id, date',
  settings: '++id',
  routines: '++id, block, order, startTime',
  routineCompletions: '++id, routineId, date, [routineId+date]',
  userProfile: '++id',
  chatMessages: '++id, createdAt',
});

db.version(12).stores({
  tasks: '++id, categoryId, completed, dueDate, createdAt, completedAt, block, parentId, startDate, calendarDisplay, isFolder, reminder',
  categories: '++id, name, order, type, parentId',
  reflections: '++id, date',
  settings: '++id',
  routines: '++id, block, order, startTime',
  routineCompletions: '++id, routineId, date, [routineId+date]',
  userProfile: '++id',
  chatMessages: '++id, createdAt',
});

db.version(13).stores({
  tasks: '++id, categoryId, completed, dueDate, createdAt, completedAt, block, parentId, startDate, calendarDisplay, isFolder, reminder',
  categories: '++id, name, order, type, parentId',
  reflections: '++id, date',
  settings: '++id',
  routines: '++id, block, order, startTime',
  routineCompletions: '++id, routineId, date, [routineId+date]',
  userProfile: '++id',
  chatMessages: '++id, createdAt',
  checkLists: '++id, type, order',
  checkListItems: '++id, listId, checked, order',
  purchaseHistory: '++id, listId, purchasedAt',
});

db.version(14).stores({
  tasks: '++id, categoryId, completed, dueDate, createdAt, completedAt, block, parentId, startDate, calendarDisplay, isFolder, reminder',
  categories: '++id, name, order, type, parentId',
  reflections: '++id, date',
  settings: '++id',
  routines: '++id, block, order, startTime',
  routineCompletions: '++id, routineId, date, [routineId+date]',
  userProfile: '++id',
  chatMessages: '++id, createdAt',
  checkLists: '++id, type, order, categoryId',
  checkListItems: '++id, listId, checked, order',
  purchaseHistory: '++id, listId, purchasedAt',
});

export { db };
