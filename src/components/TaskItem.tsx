'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { playCompleteSound } from '@/lib/sounds';
import MiniDonut from './MiniDonut';
import type { Task, Category, Settings } from '@/types';

interface TaskItemProps {
  task: Task;
  category?: Category;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
  onAddSubtask?: (parentTask: Task) => void;
  settings?: Settings;
  compact?: boolean;
}

export default function TaskItem({ task, category, onToggle, onDelete, onEdit, onAddSubtask, settings, compact }: TaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const subtasks = useLiveQuery(
    () => task.id !== undefined
      ? db.tasks.where('parentId').equals(task.id!).toArray()
      : Promise.resolve([] as Task[]),
    [task.id]
  );

  // インライン編集開始時にフォーカス
  useEffect(() => {
    if (isInlineEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isInlineEditing]);

  const handleToggle = () => {
    if (task.id === undefined || task.isFolder) return;
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

  // 最後に完了したサブタスクを1つ戻す
  const undoLastSubtask = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!subtasks || subtasks.length === 0) return;
    const completedSubs = subtasks.filter(s => s.completed && s.completedAt);
    if (completedSubs.length === 0) return;
    const last = completedSubs.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))[0];
    if (last.id !== undefined) {
      await db.tasks.update(last.id, { completed: false, completedAt: undefined });
    }
  };

  // 長押し検出
  const handlePressStart = useCallback(() => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setShowMenu(true);
    }, 500);
  }, []);

  const handlePressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePressMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // タイトルタップ → インライン編集
  const startInlineEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (didLongPress.current) return;
    setEditTitle(task.title);
    setIsInlineEditing(true);
  }, [task.title]);

  // インライン保存
  const saveInlineEdit = useCallback(async () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title && task.id !== undefined) {
      await db.tasks.update(task.id, { title: trimmed });
    }
    setIsInlineEditing(false);
  }, [editTitle, task.title, task.id]);

  const longPressHandlers = {
    onTouchStart: handlePressStart,
    onTouchEnd: handlePressEnd,
    onTouchMove: handlePressMove,
    onMouseDown: handlePressStart,
    onMouseUp: handlePressEnd,
    onMouseLeave: handlePressEnd,
  };

  const completedSubtasks = subtasks?.filter(s => s.completed).length ?? 0;
  const totalSubtasks = subtasks?.length ?? 0;
  const allSubtasksDone = totalSubtasks > 0 && completedSubtasks === totalSubtasks;

  // アクションシート
  const actionSheet = showMenu && typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 bg-black/30 z-[9999] animate-overlay" onClick={() => setShowMenu(false)}>
      <div
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl p-5 pb-8 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-4 truncate px-1">{task.title}</p>
        <div className="space-y-1">
          <button
            onClick={() => { onEdit(task); setShowMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            <span className="text-sm text-gray-700 dark:text-gray-200">詳細を編集</span>
          </button>
          {onAddSubtask && !task.completed && (
            <button
              onClick={() => { onAddSubtask(task); setShowMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
            >
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="text-sm text-gray-700 dark:text-gray-200">サブタスクを追加</span>
            </button>
          )}
          <button
            onClick={() => { if (task.id !== undefined) onDelete(task.id); setShowMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
          >
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            <span className="text-sm text-red-500">削除</span>
          </button>
        </div>
        <button
          onClick={() => setShowMenu(false)}
          className="w-full mt-3 py-3 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  // インライン編集のinput
  const inlineInput = (className: string) => (
    <input
      ref={inputRef}
      type="text"
      value={editTitle}
      onChange={(e) => setEditTitle(e.target.value)}
      onBlur={saveInlineEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') saveInlineEdit();
        if (e.key === 'Escape') setIsInlineEditing(false);
      }}
      className={`${className} bg-transparent border-b-2 border-blue-400 focus:outline-none w-full`}
    />
  );

  // フォルダ表示
  if (task.isFolder) {
    return (
      <>
        <div
          className={`rounded-2xl border transition-all duration-300 ${allSubtasksDone ? 'opacity-50' : ''} bg-white dark:bg-gray-800/60 border-[var(--border)]`}
          style={{ boxShadow: 'var(--card-shadow)' }}
          {...longPressHandlers}
        >
          {/* フォルダヘッダー */}
          <button
            onClick={() => { if (!didLongPress.current) setIsExpanded(!isExpanded); }}
            className="w-full flex items-center gap-3 px-4 py-3"
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: category?.color || '#d1d5db' }}
            />
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {isInlineEditing ? (
              inlineInput(`text-[15px] font-medium ${allSubtasksDone ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`)
            ) : (
              <span
                className={`text-[15px] font-medium flex-1 text-left truncate ${allSubtasksDone ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}
                onClick={startInlineEdit}
              >
                {task.title}
              </span>
            )}
            {(task.startDate || task.dueDate) && (
              <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
                {task.startDate && task.dueDate
                  ? `${new Date(task.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} 〜 ${new Date(task.dueDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                  : task.startDate
                  ? `${new Date(task.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}〜`
                  : `〜${new Date(task.dueDate!).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                }
              </span>
            )}
            {totalSubtasks > 0 && (
              <MiniDonut completed={completedSubtasks} total={totalSubtasks} size={16} onClick={undoLastSubtask} />
            )}
          </button>

          {/* フォルダ中身 */}
          {isExpanded && (
            <div className="px-3 pb-3 border-t border-gray-100/80 dark:border-gray-700/50">
              {totalSubtasks > 0 && (
                <div className="mt-2 space-y-1.5">
                  {subtasks!.map((sub) => (
                    <TaskItem
                      key={sub.id}
                      task={sub}
                      category={category}
                      onToggle={onToggle}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onAddSubtask={onAddSubtask}
                      settings={settings}
                    />
                  ))}
                </div>
              )}

              {/* タスク追加 */}
              {onAddSubtask && (
                <button
                  onClick={() => onAddSubtask(task)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-[var(--accent)] dark:hover:text-[var(--accent)] mt-2 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  タスクを追加
                </button>
              )}
            </div>
          )}
        </div>
        {actionSheet}
      </>
    );
  }

  // コンパクト（グリッド）表示
  if (compact) {
    return (
      <>
        <div
          className={`rounded-xl p-3 border transition-all duration-300 ${
            task.completed ? 'opacity-50' : ''
          } bg-white dark:bg-gray-800/60 border-[var(--border)] cursor-pointer`}
          style={{ boxShadow: 'var(--card-shadow)' }}
          {...longPressHandlers}
          onClick={() => { if (!didLongPress.current) onEdit(task); }}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: category?.color || '#d1d5db' }}
            />
            <div className="flex items-center gap-1.5">
              {task.priority === 'high' && !task.completed && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (task.id !== undefined && !task.isFolder) onToggle(task.id);
                }}
                className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 active:scale-90 ${
                  task.completed
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                }`}
              >
                {task.completed && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <p className={`text-sm leading-snug mb-1 line-clamp-2 ${
            task.completed
              ? 'line-through text-gray-400 dark:text-gray-500'
              : 'text-gray-800 dark:text-gray-100 font-medium'
          }`}>
            {task.title}
          </p>
          {(task.startDate || task.dueDate) && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
              {task.startDate && task.dueDate
                ? `${new Date(task.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} 〜 ${new Date(task.dueDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                : task.startDate
                ? `${new Date(task.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}〜`
                : `〜${new Date(task.dueDate!).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
              }
            </p>
          )}
          {totalSubtasks > 0 && (
            <div className="mt-2 flex items-center justify-end">
              <MiniDonut completed={completedSubtasks} total={totalSubtasks} size={16} onClick={undoLastSubtask} />
            </div>
          )}
        </div>
        {actionSheet}
      </>
    );
  }

  // 通常タスク表示
  return (
    <>
      <div
        className={`rounded-2xl px-4 py-3.5 border transition-all duration-300 ${
          justCompleted ? 'animate-completion-flash' : ''
        } ${task.completed ? 'opacity-50' : ''} bg-white dark:bg-gray-800/60 border-[var(--border)]`}
        style={{ boxShadow: 'var(--card-shadow)' }}
        {...longPressHandlers}
      >
        <div className="flex items-center gap-3.5">
          {/* カテゴリドット */}
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: category?.color || '#d1d5db' }}
          />

          {/* サブタスク展開矢印 */}
          {totalSubtasks > 0 ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-shrink-0 -mr-1.5"
              aria-label={isExpanded ? 'サブタスクを閉じる' : 'サブタスクを開く'}
            >
              <svg
                className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : null}

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
            onClick={() => { if (!didLongPress.current && !isInlineEditing) setIsExpanded(!isExpanded); }}
          >
            {isInlineEditing ? (
              <>
                {inlineInput(`text-[15px] leading-snug ${
                  task.completed
                    ? 'text-gray-400 dark:text-gray-500'
                    : 'text-gray-800 dark:text-gray-100 font-medium'
                }`)}
              </>
            ) : (
              <p
                className={`text-[15px] leading-snug transition-all duration-300 truncate ${
                  task.completed
                    ? 'line-through text-gray-400 dark:text-gray-500'
                    : 'text-gray-800 dark:text-gray-100 font-medium'
                }`}
                onClick={startInlineEdit}
              >
                {task.title}
              </p>
            )}
          </div>

          {/* 期間・期限 */}
          {(task.startDate || task.dueDate) && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
              {task.startDate && task.dueDate
                ? `${new Date(task.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} 〜 ${new Date(task.dueDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                : task.startDate
                ? `${new Date(task.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}〜`
                : `〜${new Date(task.dueDate!).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
              }
            </span>
          )}

          {/* サブタスク進捗（スペース固定） */}
          <div className="w-[18px] h-[18px] flex-shrink-0">
            {totalSubtasks > 0 && (
              <MiniDonut completed={completedSubtasks} total={totalSubtasks} size={18} onClick={undoLastSubtask} />
            )}
          </div>

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
                    <span className={`text-sm truncate flex-1 min-w-0 ${
                      sub.completed
                        ? 'line-through text-gray-400 dark:text-gray-500'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {sub.title}
                    </span>
                    {(sub.startDate || sub.dueDate) && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
                        {sub.startDate && sub.dueDate
                          ? `${new Date(sub.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}〜${new Date(sub.dueDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                          : sub.startDate
                          ? `${new Date(sub.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}〜`
                          : `〜${new Date(sub.dueDate!).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                        }
                      </span>
                    )}
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
      {actionSheet}
    </>
  );
}
