'use client';

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import TaskItem from './TaskItem';
import MiniDonut from './MiniDonut';
import { playCompleteSound } from '@/lib/sounds';
import type { Task, Category, Settings } from '@/types';

interface TasksViewProps {
  onEditTask: (task: Task) => void;
  onAddSubtask: (parentTask: Task) => void;
  settings: Settings | undefined;
}

export default function TasksView({ onEditTask, onAddSubtask, settings }: TasksViewProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());
  const [collapsedSubs, setCollapsedSubs] = useState<Set<number>>(new Set());
  const [expandedGridCategories, setExpandedGridCategories] = useState<Set<number>>(new Set());
  const [expandedGridTasks, setExpandedGridTasks] = useState<Set<number>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const [menuTask, setMenuTask] = useState<Task | null>(null);
  const [inlineEditId, setInlineEditId] = useState<number | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const handlePressStart = useCallback((task: Task) => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setMenuTask(task);
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

  const startGridInlineEdit = useCallback((task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (didLongPress.current) return;
    setInlineEditId(task.id!);
    setInlineEditValue(task.title);
  }, []);

  const saveGridInlineEdit = useCallback(async () => {
    const trimmed = inlineEditValue.trim();
    if (trimmed && inlineEditId !== null) {
      const task = await db.tasks.get(inlineEditId);
      if (task && trimmed !== task.title) {
        await db.tasks.update(inlineEditId, { title: trimmed });
      }
    }
    setInlineEditId(null);
  }, [inlineEditValue, inlineEditId]);

  const gridLongPressHandlers = (task: Task) => ({
    onTouchStart: () => handlePressStart(task),
    onTouchEnd: handlePressEnd,
    onTouchMove: handlePressMove,
    onMouseDown: () => handlePressStart(task),
    onMouseUp: handlePressEnd,
    onMouseLeave: handlePressEnd,
  });

  const viewMode = settings?.viewMode || 'list';
  const setViewMode = async (mode: 'list' | 'grid') => {
    const { updateSettings } = await import('@/lib/settings');
    await updateSettings({ viewMode: mode });
  };

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());
  const allDbTasks = useLiveQuery(() => db.tasks.toArray());
  const tasks = allDbTasks?.filter(t => !t.parentId);

  if (!categories || !tasks || !allDbTasks) {
    return <div className="flex items-center justify-center py-12 text-gray-400 text-sm">読み込み中...</div>;
  }

  // 親カテゴリとサブカテゴリに分ける
  const parentCategories = categories.filter(c => !c.parentId);
  const subCategories = categories.filter(c => !!c.parentId);

  const getSubCategories = (parentId: number) =>
    subCategories.filter(c => c.parentId === parentId).sort((a, b) => a.order - b.order);

  const getTasksForCategory = (categoryId: number) =>
    tasks.filter(t => t.categoryId === categoryId);

  // サブカテゴリがある親カテゴリは、サブカテゴリのタスクも集計
  const getAllTasksForParent = (parentId: number) => {
    const subs = getSubCategories(parentId);
    const subIds = subs.map(s => s.id!);
    return tasks.filter(t => t.categoryId === parentId || subIds.includes(t.categoryId));
  };

  const toggleCategory = (id: number) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSub = (id: number) => {
    setCollapsedSubs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const sortBy = settings?.sortBy || 'priority';

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
    const subtasks = await db.tasks.where('parentId').equals(id).toArray();
    const subtaskIds = subtasks.map(s => s.id!).filter(Boolean);
    if (subtaskIds.length > 0) {
      await db.tasks.bulkDelete(subtaskIds);
    }
    await db.tasks.delete(id);
  };

  const getCategoryForTask = (categoryId: number) => {
    return categories.find(c => c.id === categoryId);
  };

  const getChildTasks = (taskId: number) =>
    allDbTasks.filter(t => t.parentId === taskId);

  const hasChildren = (task: Task) =>
    task.isFolder || allDbTasks.some(t => t.parentId === task.id);

  const toggleGridCategory = (id: number) => {
    setExpandedGridCategories(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGridTask = (id: number) => {
    setExpandedGridTasks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalTasks = tasks.length;
  const completedCount = tasks.filter(t => t.completed).length;

  // タスクリストのレンダリング
  const renderTaskList = (taskList: Task[], category?: Category) => {
    const active = taskList.filter(t => !t.completed);
    const completed = taskList.filter(t => t.completed);
    const sorted = sortTasks(active);
    const allItems = [...sorted, ...(showCompleted ? completed : [])];

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-2 gap-2">
          {allItems.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              category={category || getCategoryForTask(task.categoryId)}
              onToggle={toggleTask}
              onDelete={deleteTask}
              onEdit={onEditTask}
              onAddSubtask={onAddSubtask}
              settings={settings}
              compact
            />
          ))}
        </div>
      );
    }

    return (
      <>
        {sorted.map(task => (
          <TaskItem
            key={task.id}
            task={task}
            category={category || getCategoryForTask(task.categoryId)}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onEdit={onEditTask}
            onAddSubtask={onAddSubtask}
            settings={settings}
          />
        ))}
        {showCompleted && completed.map(task => (
          <TaskItem
            key={task.id}
            task={task}
            category={category || getCategoryForTask(task.categoryId)}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onEdit={onEditTask}
            onAddSubtask={onAddSubtask}
            settings={settings}
          />
        ))}
      </>
    );
  };

  return (
    <div className="space-y-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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
          {/* 表示切り替え */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-700 dark:text-gray-200'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
              aria-label="リスト表示"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-700 dark:text-gray-200'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
              aria-label="グリッド表示"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            </button>
          </div>
        </div>
        {completedCount > 0 && (
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-xs text-gray-500 dark:text-gray-400"
          >
            完了済み {showCompleted ? '隠す' : `表示(${completedCount})`}
          </button>
        )}
      </div>

      {totalTasks === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">タスクはまだないよ</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">右下の＋から追加してみよう</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* グリッド表示: カテゴリごとに1ブロック */
        <div className="grid grid-cols-2 gap-2.5 items-start">
          {parentCategories.map(parent => {
            const subs = getSubCategories(parent.id!);
            const allTasks = getAllTasksForParent(parent.id!);
            const active = allTasks.filter(t => !t.completed);
            const completed = allTasks.filter(t => t.completed);
            const sorted = sortTasks(active);
            const displayTasks = [...sorted, ...(showCompleted ? completed : [])];

            if (allTasks.length === 0) return null;

            return (
              <div
                key={parent.id}
                className="rounded-xl border border-[var(--border)] bg-white dark:bg-gray-800/60 overflow-hidden"
                style={{ boxShadow: 'var(--card-shadow)' }}
              >
                {/* カテゴリヘッダー */}
                <button
                  onClick={() => toggleGridCategory(parent.id!)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                >
                  <svg
                    className={`w-3 h-3 text-gray-400 transition-transform ${expandedGridCategories.has(parent.id!) ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: parent.color }}
                  />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">{parent.name}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto flex-shrink-0">
                    {active.length > 0 ? `${active.length}` : ''}
                  </span>
                </button>

                {/* タスク一覧 */}
                {expandedGridCategories.has(parent.id!) && <div className="px-2.5 py-2 space-y-1">
                  {displayTasks.length === 0 && (
                    <p className="text-[11px] text-gray-300 dark:text-gray-600 text-center py-2">なし</p>
                  )}
                  {displayTasks.map(task => {
                    // フォルダ/親タスクはブロック表示
                    if (hasChildren(task)) {
                      const children = getChildTasks(task.id!);
                      const activeChildren = children.filter(c => !c.completed);
                      const completedChildren = children.filter(c => c.completed);
                      const displayChildren = [...activeChildren, ...(showCompleted ? completedChildren : [])];
                      return (
                        <div
                          key={task.id}
                          className="rounded-lg border border-gray-200 dark:border-gray-600/50 bg-gray-50/50 dark:bg-gray-700/30 overflow-hidden"
                        >
                          {/* 親タスクヘッダー */}
                          <div
                            className="flex items-center gap-2 px-2.5 py-2 border-b border-gray-200/60 dark:border-gray-600/40 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors"
                            onClick={() => { if (!didLongPress.current) toggleGridTask(task.id!); }}
                            {...gridLongPressHandlers(task)}
                          >
                            <svg
                              className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${expandedGridTasks.has(task.id!) ? 'rotate-90' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            {task.isFolder ? (
                              <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: parent.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                              </svg>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (task.id !== undefined) toggleTask(task.id);
                                }}
                                className={`w-[16px] h-[16px] rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${
                                  task.completed
                                    ? 'bg-green-500 border-green-500'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                                }`}
                              >
                                {task.completed && (
                                  <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            )}
                            {inlineEditId === task.id ? (
                              <input
                                type="text"
                                value={inlineEditValue}
                                onChange={(e) => setInlineEditValue(e.target.value)}
                                onBlur={saveGridInlineEdit}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveGridInlineEdit(); if (e.key === 'Escape') setInlineEditId(null); }}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                                className="text-xs font-medium flex-1 bg-transparent border-b-2 border-blue-400 focus:outline-none text-gray-700 dark:text-gray-200 min-w-0"
                              />
                            ) : (
                              <span
                                className={`text-xs font-medium truncate flex-1 ${
                                  task.completed ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-200'
                                }`}
                                onClick={(e) => startGridInlineEdit(task, e)}
                              >
                                {task.title}
                              </span>
                            )}
                            {(task.startDate || task.dueDate) && (
                              <span className="text-[9px] text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
                                {task.startDate && task.dueDate
                                  ? `${new Date(task.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}〜${new Date(task.dueDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                                  : task.startDate
                                  ? `${new Date(task.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}〜`
                                  : `〜${new Date(task.dueDate!).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                                }
                              </span>
                            )}
                            {children.length > 0 && (
                              <MiniDonut
                                completed={children.filter(c => c.completed).length}
                                total={children.length}
                                size={14}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const completedChildren = children.filter(c => c.completed && c.completedAt);
                                  if (completedChildren.length === 0) return;
                                  const last = completedChildren.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))[0];
                                  if (last.id !== undefined) {
                                    await db.tasks.update(last.id, { completed: false, completedAt: undefined });
                                  }
                                }}
                              />
                            )}
                          </div>
                          {/* サブタスク */}
                          {expandedGridTasks.has(task.id!) && <div className="px-2 py-1.5 space-y-0.5">
                            {displayChildren.map(child => (
                              <div
                                key={child.id}
                                className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-600/30 transition-colors ${
                                  child.completed ? 'opacity-50' : ''
                                }`}
                                {...gridLongPressHandlers(child)}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (child.id !== undefined) toggleTask(child.id);
                                  }}
                                  className={`w-[14px] h-[14px] rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${
                                    child.completed
                                      ? 'bg-green-500 border-green-500'
                                      : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                                  }`}
                                >
                                  {child.completed && (
                                    <svg className="w-1.5 h-1.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                                {inlineEditId === child.id ? (
                                  <input
                                    type="text"
                                    value={inlineEditValue}
                                    onChange={(e) => setInlineEditValue(e.target.value)}
                                    onBlur={saveGridInlineEdit}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveGridInlineEdit(); if (e.key === 'Escape') setInlineEditId(null); }}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                    className="text-[11px] leading-snug flex-1 bg-transparent border-b-2 border-blue-400 focus:outline-none text-gray-600 dark:text-gray-300 min-w-0"
                                  />
                                ) : (
                                  <p
                                    className={`text-[11px] leading-snug truncate flex-1 ${
                                      child.completed
                                        ? 'line-through text-gray-400 dark:text-gray-500'
                                        : 'text-gray-600 dark:text-gray-300'
                                    }`}
                                    onClick={(e) => startGridInlineEdit(child, e)}
                                  >
                                    {child.title}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>}
                        </div>
                      );
                    }

                    // 通常タスク
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors ${
                          task.completed ? 'opacity-50' : ''
                        }`}
                        {...gridLongPressHandlers(task)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (task.id !== undefined && !task.isFolder) toggleTask(task.id);
                          }}
                          className={`w-[16px] h-[16px] rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${
                            task.completed
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                          }`}
                        >
                          {task.completed && (
                            <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          {inlineEditId === task.id ? (
                            <input
                              type="text"
                              value={inlineEditValue}
                              onChange={(e) => setInlineEditValue(e.target.value)}
                              onBlur={saveGridInlineEdit}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveGridInlineEdit(); if (e.key === 'Escape') setInlineEditId(null); }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              className="text-xs leading-snug bg-transparent border-b-2 border-blue-400 focus:outline-none text-gray-700 dark:text-gray-200 w-full"
                            />
                          ) : (
                            <p
                              className={`text-xs leading-snug truncate ${
                                task.completed
                                  ? 'line-through text-gray-400 dark:text-gray-500'
                                  : 'text-gray-700 dark:text-gray-200'
                              }`}
                              onClick={(e) => startGridInlineEdit(task, e)}
                            >
                              {task.title}
                            </p>
                          )}
                          {(task.startDate || task.dueDate) && (
                            <p className="text-[10px] text-gray-400 dark:text-gray-500">
                              {task.dueDate
                                ? `〜${new Date(task.dueDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                                : `${new Date(task.startDate!).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}〜`
                              }
                            </p>
                          )}
                        </div>
                        {task.priority === 'high' && !task.completed && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>}
              </div>
            );
          })}
        </div>
      ) : (
        /* リスト表示 */
        <div className="space-y-2">
          {parentCategories.map(parent => {
            const subs = getSubCategories(parent.id!);
            const allTasks = getAllTasksForParent(parent.id!);
            const activeCount = allTasks.filter(t => !t.completed).length;
            const isCollapsed = collapsedCategories.has(parent.id!);

            if (allTasks.length === 0) return null;

            const directTasks = getTasksForCategory(parent.id!);

            return (
              <div key={parent.id} className="rounded-xl overflow-hidden">
                {/* 親カテゴリヘッダー */}
                <button
                  onClick={() => toggleCategory(parent.id!)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: parent.color }} />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{parent.name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                    {activeCount > 0 ? `${activeCount}件` : ''}
                  </span>
                </button>

                {/* 中身 */}
                {!isCollapsed && (
                  <div className="pl-4">
                    {subs.map(sub => {
                      const subTasks = getTasksForCategory(sub.id!);
                      const subActiveCount = subTasks.filter(t => !t.completed).length;
                      const isSubCollapsed = collapsedSubs.has(sub.id!);

                      if (subTasks.length === 0) return null;

                      return (
                        <div key={sub.id}>
                          <button
                            onClick={() => toggleSub(sub.id!)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                          >
                            <svg
                              className={`w-3 h-3 text-gray-300 transition-transform ${isSubCollapsed ? '' : 'rotate-90'}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{sub.name}</span>
                            <span className="text-[10px] text-gray-300 dark:text-gray-600 ml-auto">
                              {subActiveCount > 0 ? `${subActiveCount}` : ''}
                            </span>
                          </button>
                          {!isSubCollapsed && (
                            <div className="pl-3 space-y-1 pb-1">
                              {renderTaskList(subTasks, sub)}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {directTasks.length > 0 && (
                      <div className={`space-y-1 ${subs.length > 0 ? 'pt-1 border-t border-gray-100 dark:border-gray-800' : ''} pb-1 px-3`}>
                        {subs.length > 0 && (
                          <span className="text-[10px] text-gray-300 dark:text-gray-600 px-1">その他</span>
                        )}
                        {renderTaskList(directTasks, parent)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* グリッド表示用アクションシート */}
      {menuTask && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/30 z-[9999] animate-overlay" onClick={() => setMenuTask(null)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl p-5 pb-8 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-4 truncate px-1">{menuTask.title}</p>
            <div className="space-y-1">
              <button
                onClick={() => { onEditTask(menuTask); setMenuTask(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                <span className="text-sm text-gray-700 dark:text-gray-200">詳細を編集</span>
              </button>
              {!menuTask.completed && (
                <button
                  onClick={() => { onAddSubtask(menuTask); setMenuTask(null); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-200">サブタスクを追加</span>
                </button>
              )}
              <button
                onClick={() => { if (menuTask.id !== undefined) deleteTask(menuTask.id); setMenuTask(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                <span className="text-sm text-red-500">削除</span>
              </button>
            </div>
            <button
              onClick={() => setMenuTask(null)}
              className="w-full mt-3 py-3 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
