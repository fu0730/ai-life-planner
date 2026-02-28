'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import TaskItem from './TaskItem';
import ProgressBar from './ProgressBar';
import { playCompleteSound, playAllCompleteSound } from '@/lib/sounds';
import type { Task, Settings } from '@/types';

interface TodayViewProps {
  onEditTask: (task: Task) => void;
  settings: Settings | undefined;
}

type SubTab = 'tasks' | 'routine';

export default function TodayView({ onEditTask, settings }: TodayViewProps) {
  const [subTab, setSubTab] = useState<SubTab>('tasks');
  const [allDoneChoice, setAllDoneChoice] = useState<'none' | 'more' | 'rest'>('none');
  const today = new Date().toISOString().split('T')[0];

  const tasks = useLiveQuery(
    () => db.tasks.filter((t) => {
      if (t.completed && t.completedAt) {
        const completedDate = t.completedAt.split('T')[0];
        if (completedDate === today) return true;
      }
      if (t.dueDate === today) return true;
      if (!t.dueDate && !t.completed) return true;
      return false;
    }).toArray(),
    [today]
  );

  const categories = useLiveQuery(() => db.categories.toArray());

  if (!tasks || !categories) {
    return <div className="flex items-center justify-center py-12 text-gray-400 text-sm">読み込み中...</div>;
  }

  const sortBy = settings?.sortBy || 'priority';
  const completed = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const allDone = total > 0 && completed === total;

  const toggleTask = async (id: number) => {
    const task = await db.tasks.get(id);
    if (!task) return;
    const nowCompleting = !task.completed;
    await db.tasks.update(id, {
      completed: nowCompleting,
      completedAt: nowCompleting ? new Date().toISOString() : undefined,
    });

    if (nowCompleting && settings?.soundEnabled !== false) {
      const updatedTasks = await db.tasks.filter((t) => {
        if (t.id === id) return true;
        const todayStr = new Date().toISOString().split('T')[0];
        if (t.completed && t.completedAt?.split('T')[0] === todayStr) return true;
        if (t.dueDate === todayStr) return true;
        if (!t.dueDate && !t.completed) return true;
        return false;
      }).toArray();
      const newCompleted = updatedTasks.filter((t) => t.id === id ? true : t.completed).length;
      if (newCompleted === updatedTasks.length) {
        playAllCompleteSound();
      } else {
        playCompleteSound();
      }
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
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
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
      <div className="text-center py-2">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {new Date().toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </p>
      </div>

      {/* ルーティン/やること 切り替え */}
      <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
        <button
          onClick={() => setSubTab('tasks')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            subTab === 'tasks'
              ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          やること
        </button>
        <button
          onClick={() => setSubTab('routine')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            subTab === 'routine'
              ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          ルーティン
        </button>
      </div>

      {subTab === 'routine' ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🔄</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">ルーティン機能は準備中</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">もうすぐ使えるようになるよ</p>
        </div>
      ) : (
        <>
          {total > 0 && <ProgressBar completed={completed} total={total} />}

          {/* 全完了演出 */}
          {allDone && allDoneChoice === 'none' && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 text-center border border-green-100 dark:border-green-800 animate-fade-in">
              <p className="text-4xl mb-3">🎉</p>
              <p className="text-green-700 dark:text-green-300 font-bold text-lg">全部おわったね！</p>
              <p className="text-green-600 dark:text-green-400 text-sm mt-1 mb-4">おつかれさま！</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setAllDoneChoice('more')}
                  className="px-4 py-2.5 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 transition-colors font-medium"
                >
                  もうちょっとやってみる
                </button>
                <button
                  onClick={() => setAllDoneChoice('rest')}
                  className="px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600 font-medium"
                >
                  今日はゆっくりする
                </button>
              </div>
            </div>
          )}

          {allDone && allDoneChoice === 'rest' && (
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 text-center border border-purple-100 dark:border-purple-800 animate-fade-in">
              <p className="text-4xl mb-3">🌙</p>
              <p className="text-purple-700 dark:text-purple-300 font-bold">今日やること全部やりきったね</p>
              <p className="text-purple-600 dark:text-purple-400 text-sm mt-1">しっかり休むのも大事だよ</p>
            </div>
          )}

          {allDone && allDoneChoice === 'more' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 text-center border border-blue-100 dark:border-blue-800 animate-fade-in">
              <p className="text-4xl mb-3">✨</p>
              <p className="text-blue-700 dark:text-blue-300 font-bold">いいね！</p>
              <p className="text-blue-600 dark:text-blue-400 text-sm mt-1">ボーナスタスクはAI機能実装後に提案できるようになるよ</p>
            </div>
          )}

          {total === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">✨</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">今日のタスクはまだないよ</p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">右下の＋から追加してみよう</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortTasks(tasks).map((task) => (
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
        </>
      )}
    </div>
  );
}
