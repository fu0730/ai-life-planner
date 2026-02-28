'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import TaskItem from './TaskItem';
import ProgressBar from './ProgressBar';
import { playCompleteSound, playAllCompleteSound } from '@/lib/sounds';
import type { Task, Routine, RoutineCompletion, Settings, TimeBlock } from '@/types';

interface TodayViewProps {
  onEditTask: (task: Task) => void;
  onEditRoutine: (routine: Routine) => void;
  settings: Settings | undefined;
}

const BLOCKS: { key: TimeBlock; label: string; emoji: string }[] = [
  { key: 'morning', label: '朝', emoji: '🌅' },
  { key: 'forenoon', label: '午前', emoji: '🌤' },
  { key: 'afternoon', label: '午後', emoji: '🌇' },
  { key: 'night', label: '夜', emoji: '🌙' },
];

interface RoutineItemProps {
  routine: Routine;
  completed: boolean;
  onToggle: () => void;
  onEdit: (routine: Routine) => void;
  onDelete: (id: number) => void;
}

function RoutineItem({ routine, completed, onToggle, onEdit, onDelete }: RoutineItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const handleToggle = () => {
    if (!completed) {
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 600);
    }
    onToggle();
  };

  return (
    <div
      className={`rounded-xl p-4 shadow-sm border transition-all duration-300 ${
        justCompleted ? 'scale-[1.02] bg-green-50 dark:bg-green-900/20' : 'bg-white dark:bg-gray-800'
      } ${completed ? 'opacity-60' : ''}`}
      style={{ borderLeftColor: '#8B5CF6', borderLeftWidth: '4px' }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggle}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
            completed
              ? 'bg-green-500 border-green-500 scale-110'
              : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
          }`}
        >
          {completed && (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <p className={`text-sm font-medium transition-all duration-300 ${
            completed
              ? 'line-through text-gray-400 dark:text-gray-500'
              : 'text-gray-800 dark:text-gray-100'
          }`}>
            {routine.title}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {routine.estimatedMinutes && (
            <span className="text-xs text-purple-500 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
              🔄 {routine.estimatedMinutes}分
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => onEdit(routine)}
              className="text-xs text-blue-500 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            >
              編集
            </button>
            <button
              onClick={() => routine.id !== undefined && onDelete(routine.id)}
              className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            >
              削除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TodayView({ onEditTask, onEditRoutine, settings }: TodayViewProps) {
  const [allDoneChoice, setAllDoneChoice] = useState<'none' | 'more' | 'rest'>('none');
  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().getDay(); // 0=日, 1=月, ...

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

  const routines = useLiveQuery(
    () => db.routines.orderBy('order').toArray(),
    []
  );

  const completions = useLiveQuery(
    () => db.routineCompletions.where('date').equals(today).toArray(),
    [today]
  );

  const categories = useLiveQuery(() => db.categories.toArray());

  if (!tasks || !categories || !routines || !completions) {
    return <div className="flex items-center justify-center py-12 text-gray-400 text-sm">読み込み中...</div>;
  }

  // 今日の曜日に該当するルーティンのみ
  const todayRoutines = routines.filter((r) => r.days.includes(dayOfWeek));

  const completionSet = new Set(completions.map((c) => c.routineId));

  // 進捗計算
  const totalItems = tasks.length + todayRoutines.length;
  const completedRoutines = todayRoutines.filter((r) => r.id !== undefined && completionSet.has(r.id)).length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const completedItems = completedRoutines + completedTasks;
  const allDone = totalItems > 0 && completedItems === totalItems;

  const toggleRoutine = async (routineId: number) => {
    if (completionSet.has(routineId)) {
      // 完了解除
      const completion = completions.find((c) => c.routineId === routineId);
      if (completion?.id) {
        await db.routineCompletions.delete(completion.id);
      }
    } else {
      // 完了
      await db.routineCompletions.add({
        routineId,
        date: today,
        completedAt: new Date().toISOString(),
      });

      if (settings?.soundEnabled !== false) {
        // 全完了チェック
        const newCompletedRoutines = completedRoutines + 1;
        if (newCompletedRoutines + completedTasks === totalItems) {
          playAllCompleteSound();
        } else {
          playCompleteSound();
        }
      }
    }
  };

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
      const newCompletedTasks = updatedTasks.filter((t) => t.id === id ? true : t.completed).length;
      if (newCompletedTasks + completedRoutines === totalItems) {
        playAllCompleteSound();
      } else {
        playCompleteSound();
      }
    }
  };

  const deleteTask = async (id: number) => {
    await db.tasks.delete(id);
  };

  const deleteRoutine = async (id: number) => {
    await db.routines.delete(id);
    // その日の完了記録も削除
    await db.routineCompletions.where({ routineId: id, date: today }).delete();
  };

  const getCategoryForTask = (categoryId: number) => {
    return categories.find((c) => c.id === categoryId);
  };

  const sortTasks = (taskList: Task[]) => {
    const sortBy = settings?.sortBy || 'priority';
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

  // ブロックごとにアイテムを分類
  const getBlockRoutines = (block: TimeBlock) =>
    todayRoutines.filter((r) => r.block === block);

  const getBlockTasks = (block: TimeBlock) =>
    sortTasks(tasks.filter((t) => t.block === block));

  const unblockedTasks = sortTasks(tasks.filter((t) => !t.block));

  const hasBlockItems = (block: TimeBlock) =>
    getBlockRoutines(block).length > 0 || getBlockTasks(block).length > 0;

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

      {totalItems > 0 && <ProgressBar completed={completedItems} total={totalItems} />}

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

      {totalItems === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">✨</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">今日のタスク・ルーティンはまだないよ</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">右下の＋から追加してみよう</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* ブロック別表示 */}
          {BLOCKS.map((block) => {
            if (!hasBlockItems(block.key)) return null;
            const blockRoutines = getBlockRoutines(block.key);
            const blockTasks = getBlockTasks(block.key);

            return (
              <div key={block.key}>
                <div className="flex items-center gap-2 py-3 px-1">
                  <span className="text-base">{block.emoji}</span>
                  <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{block.label}</span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </div>
                <div className="space-y-2">
                  {blockRoutines.map((routine) => (
                    <RoutineItem
                      key={`r-${routine.id}`}
                      routine={routine}
                      completed={routine.id !== undefined && completionSet.has(routine.id)}
                      onToggle={() => routine.id !== undefined && toggleRoutine(routine.id)}
                      onEdit={onEditRoutine}
                      onDelete={deleteRoutine}
                    />
                  ))}
                  {blockTasks.map((task) => (
                    <TaskItem
                      key={`t-${task.id}`}
                      task={task}
                      category={getCategoryForTask(task.categoryId)}
                      onToggle={toggleTask}
                      onDelete={deleteTask}
                      onEdit={onEditTask}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* いつでもセクション */}
          {unblockedTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 py-3 px-1">
                <span className="text-base">📌</span>
                <span className="text-sm font-bold text-gray-600 dark:text-gray-300">いつでも</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>
              <div className="space-y-2">
                {unblockedTasks.map((task) => (
                  <TaskItem
                    key={`t-${task.id}`}
                    task={task}
                    category={getCategoryForTask(task.categoryId)}
                    onToggle={toggleTask}
                    onDelete={deleteTask}
                    onEdit={onEditTask}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
