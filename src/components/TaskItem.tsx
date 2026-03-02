'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { playCompleteSound } from '@/lib/sounds';
import type { Task, Category, Settings } from '@/types';

interface TaskItemProps {
  task: Task;
  category?: Category;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
  onAddSubtask?: (parentTask: Task) => void;
  settings?: Settings;
}

export default function TaskItem({ task, category, onToggle, onDelete, onEdit, onAddSubtask, settings }: TaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const subtasks = useLiveQuery(
    () => task.id !== undefined
      ? db.tasks.where('parentId').equals(task.id!).toArray()
      : Promise.resolve([] as Task[]),
    [task.id]
  );

  const handleToggle = () => {
    if (task.id === undefined) return;
    if (!task.completed) {
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 600);
    }
    onToggle(task.id);
  };

  const toggleSubtask = async (id: number) => {
    const sub = await db.tasks.get(id);
    if (!sub) return;
    const nowCompleting = !sub.completed;
    await db.tasks.update(id, {
      completed: nowCompleting,
      completedAt: nowCompleting ? new Date().toISOString() : undefined,
    });
    if (nowCompleting && settings?.soundEnabled !== false) {
      playCompleteSound();
    }
  };

  const deleteSubtask = async (id: number) => {
    await db.tasks.delete(id);
  };

  const completedSubtasks = subtasks?.filter(s => s.completed).length ?? 0;
  const totalSubtasks = subtasks?.length ?? 0;

  return (
    <div
      className={`rounded-2xl px-4 py-3.5 border transition-all duration-300 ${
        justCompleted ? 'animate-completion-flash' : ''
      } ${task.completed ? 'opacity-50' : ''} bg-white dark:bg-gray-800/60 border-[var(--border)]`}
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex items-center gap-3.5">
        {/* カテゴリドット */}
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: category?.color || '#d1d5db' }}
        />

        {/* チェックボタン */}
        <button
          onClick={handleToggle}
          aria-label={task.completed ? `${task.title}を未完了にする` : `${task.title}を完了にする`}
          className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 active:scale-90 ${
            task.completed
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
          } ${justCompleted ? 'animate-ripple' : ''}`}
        >
          {task.completed && (
            <svg className="w-3 h-3 text-white animate-check-pop" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* タイトル */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <p className={`text-[15px] leading-snug transition-all duration-300 ${
            task.completed
              ? 'line-through text-gray-400 dark:text-gray-500'
              : 'text-gray-800 dark:text-gray-100 font-medium'
          }`}>
            {task.title}
          </p>
          {(task.startDate || task.dueDate) && !task.completed && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {task.startDate && task.dueDate
                ? `${new Date(task.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} 〜 ${new Date(task.dueDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                : task.startDate
                ? `${new Date(task.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}〜`
                : `〜${new Date(task.dueDate!).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
              }
            </p>
          )}
        </div>

        {/* サブタスク進捗 */}
        {totalSubtasks > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 tabular-nums">
            {completedSubtasks}/{totalSubtasks}
          </span>
        )}

        {/* 優先度ドット */}
        {task.priority === 'high' && !task.completed && (
          <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
        )}
      </div>

      {/* 展開部分 */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-100/80 dark:border-gray-700/50">
          {task.memo && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">{task.memo}</p>
          )}

          {/* サブタスク一覧 */}
          {totalSubtasks > 0 && (
            <div className="mb-3 space-y-1.5">
              {subtasks!.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2.5 pl-1">
                  <div className="w-3 border-l border-b border-gray-200 dark:border-gray-600 h-3 flex-shrink-0" />
                  <button
                    onClick={() => sub.id !== undefined && toggleSubtask(sub.id)}
                    className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 active:scale-90 ${
                      sub.completed
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                    }`}
                  >
                    {sub.completed && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm truncate block ${
                      sub.completed
                        ? 'line-through text-gray-400 dark:text-gray-500'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {sub.title}
                    </span>
                    {(sub.startDate || sub.dueDate) && !sub.completed && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        {sub.startDate && sub.dueDate
                          ? `${new Date(sub.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} 〜 ${new Date(sub.dueDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                          : sub.startDate
                          ? `${new Date(sub.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}〜`
                          : `〜${new Date(sub.dueDate!).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                        }
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => sub.id !== undefined && deleteSubtask(sub.id)}
                    className="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 flex-shrink-0 transition-colors p-0.5"
                    aria-label={`${sub.title}を削除`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* サブタスク追加ボタン */}
          {onAddSubtask && !task.completed && (
            <button
              onClick={() => onAddSubtask(task)}
              className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-[var(--accent)] dark:hover:text-[var(--accent)] mb-3 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              サブタスクを追加
            </button>
          )}

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => onEdit(task)}
              className="text-xs text-[var(--accent)] px-3 py-1.5 rounded-lg hover:bg-[var(--accent-light)] active:scale-95 transition-all"
            >
              編集
            </button>
            <button
              onClick={() => task.id !== undefined && onDelete(task.id)}
              className="text-xs text-gray-400 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all"
            >
              削除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
