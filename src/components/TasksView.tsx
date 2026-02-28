'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import TaskItem from './TaskItem';
import ProgressBar from './ProgressBar';
import type { Task } from '@/types';

interface TasksViewProps {
  onEditTask: (task: Task) => void;
}

export default function TasksView({ onEditTask }: TasksViewProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());
  const tasks = useLiveQuery(
    () => {
      if (activeCategoryId === null) return db.tasks.toArray();
      return db.tasks.where('categoryId').equals(activeCategoryId).toArray();
    },
    [activeCategoryId]
  );

  if (!categories || !tasks) {
    return <div className="flex items-center justify-center py-12 text-gray-400 text-sm">読み込み中...</div>;
  }

  const completed = tasks.filter((t) => t.completed).length;
  const total = tasks.length;

  const toggleTask = async (id: number) => {
    const task = await db.tasks.get(id);
    if (!task) return;
    await db.tasks.update(id, {
      completed: !task.completed,
      completedAt: !task.completed ? new Date().toISOString() : undefined,
    });
  };

  const deleteTask = async (id: number) => {
    await db.tasks.delete(id);
  };

  const getCategoryForTask = (categoryId: number) => {
    return categories.find((c) => c.id === categoryId);
  };

  return (
    <div className="space-y-4">
      {/* カテゴリタブ */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        <button
          onClick={() => setActiveCategoryId(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            activeCategoryId === null
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          すべて
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategoryId(cat.id!)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeCategoryId === cat.id
                ? 'text-white shadow-sm'
                : 'text-gray-600 bg-gray-100'
            }`}
            style={activeCategoryId === cat.id ? { backgroundColor: cat.color } : {}}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {total > 0 && <ProgressBar completed={completed} total={total} />}

      {total === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 text-sm">タスクはまだないよ</p>
          <p className="text-gray-400 text-xs mt-1">右下の＋から追加してみよう</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks
            .sort((a, b) => {
              if (a.completed !== b.completed) return a.completed ? 1 : -1;
              const priorityOrder = { high: 0, medium: 1, low: 2 };
              return priorityOrder[a.priority] - priorityOrder[b.priority];
            })
            .map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                category={getCategoryForTask(task.categoryId)}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onEdit={onEditTask}
              />
            ))}
        </div>
      )}
    </div>
  );
}
