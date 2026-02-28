import { db } from './db';

export async function seedDefaultCategories() {
  const count = await db.categories.count();
  if (count > 0) return;

  await db.categories.bulkAdd([
    { name: '大学', color: '#3B82F6', order: 0, type: 'task' },
    { name: '仕事', color: '#8B5CF6', order: 1, type: 'task' },
    { name: '買い物', color: '#10B981', order: 2, type: 'task' },
    { name: '日常', color: '#F59E0B', order: 3, type: 'task' },
    { name: '持ち物チェック', color: '#EC4899', order: 4, type: 'checklist' },
    { name: 'やりたいこと', color: '#06B6D4', order: 5, type: 'task' },
  ]);
}
