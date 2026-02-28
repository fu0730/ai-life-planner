'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import TaskItem from './TaskItem';
import ProgressBar from './ProgressBar';
import { playCompleteSound } from '@/lib/sounds';
import type { Task, Settings } from '@/types';

interface TasksViewProps {
  onEditTask: (task: Task) => void;
  settings: Settings | undefined;
}

export default function TasksView({ onEditTask, settings }: TasksViewProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

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

  const sortBy = settings?.sortBy || 'priority';
  const activeTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);
  const completed = completedTasks.length;
  const total = tasks.length;

  const toggleTask = async (id: number) => {
    const task = await db.tasks.get(id);
    if (!task) return;
    const nowCompleting = !task.completed;
    await db.tasks.update(id, {
      completed: nowCompleting,
      completedAt: nowCompleting ? new Date().toISOString() : undefined,
    });
    if (nowCompleting && settings?.soundEnabled !== false) {
      playCompleteSound();
    }
  };

  const deleteTask = async (id: number) => {
    await db.tasks.delete(id);
  };

  const getCategoryForTask = (categoryId: number) => {
    return categories.find((c) => c.id === categoryId);
  };

  const sortTasks = (taskList: Task[]) => {
    return [...taskList].sort((a, b) => {
      if (sortBy === 'priority') {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      }
      if (sortBy === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  return (
    <div className="space-y-4">
      {/* カテゴリタブ */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        <button
          onClick={() => setActiveCategoryId(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            activeCategoryId === null
              ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
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
                : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700'
            }`}
            style={activeCategoryId === cat.id ? { backgroundColor: cat.color } : {}}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* 並び替え */}
      <div className="flex items-center justify-between">
        <select
          value={sortBy}
          onChange={async (e) => {
            const { updateSettings } = await import('@/lib/settings');
            await updateSettings({ sortBy: e.target.value as Settings['sortBy'] });
          }}
          className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg px-2 py-1 border-0 focus:outline-none"
        >
          <option value="priority">優先度順</option>
          <option value="dueDate">期限順</option>
          <option value="createdAt">作成日順</option>
        </select>
        {completedTasks.length > 0 && (
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-xs text-gray-500 dark:text-gray-400"
          >
            完了済み {showCompleted ? '隠す' : `表示(${completedTasks.length})`}
          </button>
        )}
      </div>

      {total > 0 && <ProgressBar completed={completed} total={total} />}

      {activeTasks.length === 0 && completedTasks.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">タスクはまだないよ</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">右下の＋から追加してみよう</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortTasks(activeTasks).map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              category={getCategoryForTask(task.categoryId)}
              onToggle={toggleTask}
              onDelete={deleteTask}
              onEdit={onEditTask}
            />
          ))}
          {showCompleted && completedTasks.map((task) => (
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
