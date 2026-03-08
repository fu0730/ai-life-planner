import { db } from './db';

export async function seedDefaultCategories() {
  const count = await db.categories.count();
  if (count > 0) return;

  await db.categories.bulkAdd([
    { name: '大学', color: '#3B82F6', order: 0, type: 'task' },
    { name: '仕事', color: '#8B5CF6', order: 1, type: 'task' },
    { name: '日常', color: '#F59E0B', order: 2, type: 'task' },
    { name: 'やりたいこと', color: '#06B6D4', order: 3, type: 'task' },
  ]);
}
