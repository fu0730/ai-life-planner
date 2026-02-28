'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import TaskItem from './TaskItem';
import ProgressBar from './ProgressBar';
import type { Task } from '@/types';

interface TodayViewProps {
  onEditTask: (task: Task) => void;
}

export default function TodayView({ onEditTask }: TodayViewProps) {
  const today = new Date().toISOString().split('T')[0];

  const tasks = useLiveQuery(
    () => db.tasks.filter((t) => t.dueDate === today || (!t.dueDate && !t.completed)).toArray(),
    [today]
  );

  const categories = useLiveQuery(() => db.categories.toArray());

  if (!tasks || !categories) {
    return <div className="flex items-center justify-center py-12 text-gray-400 text-sm">読み込み中...</div>;
  }

  const completed = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const allDone = total > 0 && completed === total;

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
      <div className="text-center py-2">
        <p className="text-gray-500 text-sm">
          {new Date().toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </p>
      </div>

      {total > 0 && <ProgressBar completed={completed} total={total} />}

      {allDone && (
        <div className="bg-green-50 rounded-xl p-6 text-center border border-green-100">
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-green-700 font-bold">全部おわったね！</p>
          <p className="text-green-600 text-sm mt-1">おつかれさま！</p>
        </div>
      )}

      {total === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">✨</p>
          <p className="text-gray-500 text-sm">今日のタスクはまだないよ</p>
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
