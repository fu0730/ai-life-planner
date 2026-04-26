'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TaskItem from './TaskItem';
import MiniDonut from './MiniDonut';
import { playCompleteSound } from '@/lib/sounds';
import type { Task, Category, Settings } from '@/types';

interface TasksViewProps {
  onEditTask: (task: Task) => void;
  onAddSubtask: (parentTask: Task) => void;
  settings: Settings | undefined;
}

// --- ドラッグハンドル ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TaskDragHandle({ listeners, attributes }: { listeners?: any; attributes?: any }) {
  return (
    <button
      className="touch-none p-1 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0"
      {...listeners}
      {...attributes}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="9" cy="6" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" />
        <circle cx="15" cy="18" r="1.5" />
      </svg>
    </button>
  );
}

// --- ソート可能タスクラッパー ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SortableTaskWrapper({ id, children }: { id: number; children: (props: { listeners: any; attributes: any }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ listeners, attributes })}
    </div>
  );
}

export default function TasksView({ onEditTask, onAddSubtask, settings }: TasksViewProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());
  const [userToggledCategories, setUserToggledCategories] = useState<Set<number>>(new Set());
  const [collapsedSubs, setCollapsedSubs] = useState<Set<number>>(new Set());
  const [expandedGridCategories, setExpandedGridCategories] = useState<Set<number>>(new Set());
  const [expandedGridTasks, setExpandedGridTasks] = useState<Set<number>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const [menuTask, setMenuTask] = useState<Task | null>(null);
  const [inlineEditId, setInlineEditId] = useState<number | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const [inlineAddCategoryId, setInlineAddCategoryId] = useState<number | null>(null);
  const [inlineAddValue, setInlineAddValue] = useState('');
  const inlineAddRef = useRef<HTMLInputElement>(null);
  const [inlineSubAddParentId, setInlineSubAddParentId] = useState<number | null>(null);
  const [inlineSubAddValue, setInlineSubAddValue] = useState('');
  const inlineSubAddRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  // カテゴリ操作用state
  const [menuCategory, setMenuCategory] = useState<Category | null>(null);
  const [menuSubCategory, setMenuSubCategory] = useState<Category | null>(null);
  const [editingCat, setEditingCat] = useState<{ id: number; name: string; color: string } | null>(null);
  const [addingSubTo, setAddingSubTo] = useState<number | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [managingSubsCatId, setManagingSubsCatId] = useState<number | null>(null);
  const [editingSubInManage, setEditingSubInManage] = useState<{ id: number; name: string } | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3B82F6');
  const catLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didCatLongPress = useRef(false);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const PRESET_COLORS = [
    '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899',
    '#06B6D4', '#EF4444', '#84CC16', '#F97316', '#6366F1',
  ];

  const handleCatPressStart = useCallback((cat: Category, isSub?: boolean, e?: React.TouchEvent) => {
    if (e) e.preventDefault();
    didCatLongPress.current = false;
    catLongPressTimer.current = setTimeout(() => {
      didCatLongPress.current = true;
      if (isSub) {
        setMenuSubCategory(cat);
      } else {
        setMenuCategory(cat);
      }
    }, 500);
  }, []);

  const handleCatPressEnd = useCallback(() => {
    if (catLongPressTimer.current) {
      clearTimeout(catLongPressTimer.current);
      catLongPressTimer.current = null;
    }
  }, []);

  const handleCatPressMove = useCallback(() => {
    if (catLongPressTimer.current) {
      clearTimeout(catLongPressTimer.current);
      catLongPressTimer.current = null;
    }
  }, []);

  const catLongPressHandlers = (cat: Category, isSub?: boolean) => ({
    onTouchStart: (e: React.TouchEvent) => handleCatPressStart(cat, isSub, e),
    onTouchEnd: handleCatPressEnd,
    onTouchMove: handleCatPressMove,
    onMouseDown: () => handleCatPressStart(cat, isSub),
    onMouseUp: handleCatPressEnd,
    onMouseLeave: handleCatPressEnd,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const handleDeleteCategory = async (id: number) => {
    const tasksInCat = await db.tasks.where('categoryId').equals(id).count();
    if (tasksInCat > 0) {
      alert(`このカテゴリには${tasksInCat}個のタスクがあります。先にタスクを移動してください。`);
      return;
    }
    const allCats = await db.categories.toArray();
    const subs = allCats.filter(c => c.parentId === id);
    for (const sub of subs) {
      const subTasks = await db.tasks.where('categoryId').equals(sub.id!).count();
      if (subTasks > 0) {
        alert(`サブカテゴリ「${sub.name}」にタスクがあります。先にタスクを移動してください。`);
        return;
      }
    }
    const subIds = subs.map(s => s.id!).filter(Boolean);
    if (subIds.length > 0) await db.categories.bulkDelete(subIds);
    await db.categories.delete(id);
  };

  const handleDeleteSubCategory = async (id: number) => {
    const tasksInCat = await db.tasks.where('categoryId').equals(id).count();
    if (tasksInCat > 0) {
      alert(`このサブカテゴリにはタスクがあります。先にタスクを移動してください。`);
      return;
    }
    await db.categories.delete(id);
  };

  const handleSaveEditCat = async () => {
    if (!editingCat || !editingCat.name.trim()) return;
    await db.categories.update(editingCat.id, { name: editingCat.name.trim(), color: editingCat.color });
    setEditingCat(null);
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const allCats = await db.categories.orderBy('order').toArray();
    const maxOrder = allCats.length > 0 ? Math.max(...allCats.map(c => c.order)) : -1;
    await db.categories.add({
      name: newCatName.trim(),
      color: newCatColor,
      order: maxOrder + 1,
      type: 'task',
    });
    setNewCatName('');
    setNewCatColor('#3B82F6');
    setShowAddCategory(false);
  };

  const handleAddSubCategory = async (parentId: number) => {
    if (!newSubName.trim()) return;
    const parent = categories?.find(c => c.id === parentId);
    if (!parent) return;
    const allCats = await db.categories.toArray();
    const subs = allCats.filter(c => c.parentId === parentId);
    const maxOrder = subs.length > 0 ? Math.max(...subs.map(s => s.order)) : -1;
    await db.categories.add({
      name: newSubName.trim(),
      color: parent.color,
      order: maxOrder + 1,
      type: parent.type,
      parentId,
    });
    setNewSubName('');
    setAddingSubTo(null);
  };

  const handlePressStart = useCallback((task: Task, e?: React.TouchEvent) => {
    if (e) e.preventDefault();
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
    onTouchStart: (e: React.TouchEvent) => handlePressStart(task, e),
    onTouchEnd: handlePressEnd,
    onTouchMove: handlePressMove,
    onMouseDown: () => handlePressStart(task),
    onMouseUp: handlePressEnd,
    onMouseLeave: handlePressEnd,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const startInlineAdd = useCallback((categoryId: number) => {
    setInlineAddCategoryId(categoryId);
    setInlineAddValue('');
    setTimeout(() => inlineAddRef.current?.focus(), 0);
  }, []);

  const saveInlineAdd = useCallback(async () => {
    const trimmed = inlineAddValue.trim();
    if (trimmed && inlineAddCategoryId !== null) {
      await db.tasks.add({
        title: trimmed,
        categoryId: inlineAddCategoryId,
        priority: 'medium',
        completed: false,
        createdAt: new Date().toISOString(),
      });
    }
    setInlineAddCategoryId(null);
    setInlineAddValue('');
  }, [inlineAddValue, inlineAddCategoryId]);

  const startInlineSubAdd = useCallback((parentId: number) => {
    setInlineSubAddParentId(parentId);
    setInlineSubAddValue('');
    setTimeout(() => inlineSubAddRef.current?.focus(), 0);
  }, []);

  const saveInlineSubAdd = useCallback(async () => {
    const trimmed = inlineSubAddValue.trim();
    if (trimmed && inlineSubAddParentId !== null) {
      const parent = await db.tasks.get(inlineSubAddParentId);
      if (parent) {
        await db.tasks.add({
          title: trimmed,
          categoryId: parent.categoryId,
          priority: parent.priority,
          parentId: inlineSubAddParentId,
          completed: false,
          createdAt: new Date().toISOString(),
        });
      }
    }
    setInlineSubAddParentId(null);
    setInlineSubAddValue('');
  }, [inlineSubAddValue, inlineSubAddParentId]);

  const viewMode = settings?.viewMode || 'list';
  const setViewMode = async (mode: 'list' | 'grid') => {
    const { updateSettings } = await import('@/lib/settings');
    await updateSettings({ viewMode: mode });
  };

  const handleTaskDragEnd = useCallback(async (event: DragEndEvent, taskList: Task[]) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = taskList.findIndex(t => t.id === active.id);
    const newIndex = taskList.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(taskList, oldIndex, newIndex);
    await Promise.all(
      reordered.map((task, i) => db.tasks.update(task.id!, { order: i }))
    );
  }, []);

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
    setUserToggledCategories(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
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
      if (sortBy === 'manual') {
        return (a.order ?? 0) - (b.order ?? 0);
      }
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
    const isManual = sortBy === 'manual';

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

    const renderItems = (items: Task[], draggable: boolean) =>
      items.map(task =>
        draggable ? (
          <SortableTaskWrapper key={task.id} id={task.id!}>
            {({ listeners, attributes }) => (
              <div className="flex items-center gap-1">
                <TaskDragHandle listeners={listeners} attributes={attributes} />
                <div className="flex-1 min-w-0">
                  <TaskItem
                    task={task}
                    category={category || getCategoryForTask(task.categoryId)}
                    onToggle={toggleTask}
                    onDelete={deleteTask}
                    onEdit={onEditTask}
                    onAddSubtask={onAddSubtask}
                    settings={settings}
                  />
                </div>
              </div>
            )}
          </SortableTaskWrapper>
        ) : (
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
        )
      );

    if (isManual) {
      return (
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleTaskDragEnd(e, sorted)}>
          <SortableContext items={sorted.map(t => t.id!)} strategy={verticalListSortingStrategy}>
            {renderItems(sorted, true)}
          </SortableContext>
          {showCompleted && renderItems(completed, false)}
        </DndContext>
      );
    }

    return (
      <>
        {renderItems(sorted, false)}
        {showCompleted && renderItems(completed, false)}
      </>
    );
  };

  const renderInlineAdd = (categoryId: number) => {
    if (inlineAddCategoryId === categoryId) {
      return (
        <div className="flex items-center gap-2 px-2 py-1.5">
          <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <input
            ref={inlineAddRef}
            type="text"
            value={inlineAddValue}
            onChange={(e) => setInlineAddValue(e.target.value)}
            onBlur={saveInlineAdd}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveInlineAdd();
              }
              if (e.key === 'Escape') {
                setInlineAddCategoryId(null);
                setInlineAddValue('');
              }
            }}
            placeholder="タスク名を入力"
            className="flex-1 text-xs bg-transparent border-b-2 border-blue-400 focus:outline-none text-gray-700 dark:text-gray-200 py-0.5"
            autoFocus
          />
        </div>
      );
    }
    return (
      <button
        onClick={() => startInlineAdd(categoryId)}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-[var(--accent)] dark:hover:text-[var(--accent)] transition-colors w-full"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        タスクを追加
      </button>
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
            <option value="manual">手動</option>
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

      {parentCategories.length === 0 && totalTasks === 0 ? (
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

            return (
              <div
                key={parent.id}
                className="rounded-xl border border-[var(--border)] bg-white dark:bg-gray-800/60 overflow-hidden"
                style={{ boxShadow: 'var(--card-shadow)' }}
              >
                {/* カテゴリヘッダー */}
                <button
                  onClick={() => { if (!didCatLongPress.current) toggleGridCategory(parent.id!); }}
                  {...catLongPressHandlers(parent)}
                  className="long-pressable w-full flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
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
                {(subs.length > 0 ? !expandedGridCategories.has(parent.id!) : expandedGridCategories.has(parent.id!)) && <div className="px-2.5 py-2 space-y-1">
                  {/* サブカテゴリ（授業名） */}
                  {subs.map(sub => {
                    const subTasks = getTasksForCategory(sub.id!);
                    const subActive = subTasks.filter(t => !t.completed);
                    const subCompleted = subTasks.filter(t => t.completed);
                    const subSorted = sortTasks(subActive);
                    const subDisplay = [...subSorted, ...(showCompleted ? subCompleted : [])];
                    return (
                      <div key={sub.id} className="rounded-lg overflow-hidden">
                        {/* 授業名ヘッダー */}
                        <button
                          onClick={() => { if (!didCatLongPress.current) toggleSub(sub.id!); }}
                          {...catLongPressHandlers(sub, true)}
                          className="long-pressable w-full flex items-center gap-1.5 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                        >
                          <svg
                            className={`w-2.5 h-2.5 text-gray-400 transition-transform flex-shrink-0 ${collapsedSubs.has(sub.id!) ? '' : 'rotate-90'}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <div className="w-0.5 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: parent.color, opacity: 0.6 }} />
                          <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 truncate">{sub.name}</span>
                          {subActive.length > 0 && (
                            <span className="text-[9px] text-gray-400 dark:text-gray-500 ml-auto bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded-full flex-shrink-0">
                              {subActive.length}
                            </span>
                          )}
                        </button>
                        {!collapsedSubs.has(sub.id!) && (
                          <div className="pl-3 pr-1 pb-1.5 space-y-0.5">
                            {subDisplay.map(task => {
                              const children = getChildTasks(task.id!);
                              const taskHasChildren = hasChildren(task);
                              if (taskHasChildren) {
                                const activeChildren = children.filter(c => !c.completed);
                                const completedChildren = children.filter(c => c.completed);
                                const displayChildren = [...activeChildren, ...(showCompleted ? completedChildren : [])];
                                return (
                                  <div key={task.id} className="rounded border border-gray-100 dark:border-gray-700/40 overflow-hidden mb-0.5">
                                    <div
                                      className="long-pressable flex items-center gap-1.5 px-2 py-1.5 bg-gray-50/50 dark:bg-gray-700/20 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/40 transition-colors"
                                      onClick={() => { if (!didLongPress.current) toggleGridTask(task.id!); }}
                                      {...gridLongPressHandlers(task)}
                                    >
                                      <svg
                                        className={`w-2.5 h-2.5 text-gray-400 transition-transform flex-shrink-0 ${expandedGridTasks.has(task.id!) ? 'rotate-90' : ''}`}
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                      <span className={`text-[11px] font-medium truncate flex-1 ${
                                        task.completed ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-200'
                                      }`}>{task.title}</span>
                                      {children.length > 0 && (
                                        <MiniDonut completed={children.filter(c => c.completed).length} total={children.length} size={12} />
                                      )}
                                    </div>
                                    {expandedGridTasks.has(task.id!) && (
                                      <div className="px-2 py-1 space-y-0.5">
                                        {displayChildren.map(child => (
                                          <div
                                            key={child.id}
                                            className={`long-pressable flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-600/30 transition-colors ${
                                              child.completed ? 'opacity-50' : ''
                                            }`}
                                            {...gridLongPressHandlers(child)}
                                          >
                                            <button
                                              onClick={(e) => { e.stopPropagation(); if (child.id !== undefined) toggleTask(child.id); }}
                                              className={`w-[13px] h-[13px] rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${
                                                child.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                                              }`}
                                            >
                                              {child.completed && (
                                                <svg className="w-1.5 h-1.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                              )}
                                            </button>
                                            <p className={`text-[10px] leading-snug truncate flex-1 ${
                                              child.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'
                                            }`}>{child.title}</p>
                                          </div>
                                        ))}
                                        {!task.completed && (
                                          inlineSubAddParentId === task.id ? (
                                            <div className="flex items-center gap-1.5 px-1.5 py-1">
                                              <svg className="w-2.5 h-2.5 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                                              </svg>
                                              <input
                                                ref={inlineSubAddRef}
                                                type="text"
                                                value={inlineSubAddValue}
                                                onChange={(e) => setInlineSubAddValue(e.target.value)}
                                                onBlur={saveInlineSubAdd}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') { e.preventDefault(); saveInlineSubAdd(); }
                                                  if (e.key === 'Escape') { setInlineSubAddParentId(null); setInlineSubAddValue(''); }
                                                }}
                                                placeholder="課題名"
                                                className="flex-1 text-[10px] bg-transparent border-b-2 border-blue-400 focus:outline-none text-gray-600 dark:text-gray-300 py-0.5"
                                                autoFocus
                                              />
                                            </div>
                                          ) : (
                                            <button
                                              onClick={() => startInlineSubAdd(task.id!)}
                                              className="flex items-center gap-1 px-1.5 py-1 text-[10px] text-gray-400 dark:text-gray-500 hover:text-[var(--accent)] transition-colors w-full"
                                            >
                                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                                              </svg>
                                              追加
                                            </button>
                                          )
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              return (
                                <div
                                  key={task.id}
                                  className={`long-pressable flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-600/30 transition-colors ${
                                    task.completed ? 'opacity-50' : ''
                                  }`}
                                  {...gridLongPressHandlers(task)}
                                >
                                  <button
                                    onClick={(e) => { e.stopPropagation(); if (task.id !== undefined) toggleTask(task.id); }}
                                    className={`w-[14px] h-[14px] rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${
                                      task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                                    }`}
                                  >
                                    {task.completed && (
                                      <svg className="w-1.5 h-1.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </button>
                                  <p className={`text-[11px] leading-snug truncate flex-1 ${
                                    task.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'
                                  }`}>{task.title}</p>
                                </div>
                              );
                            })}
                            {renderInlineAdd(sub.id!)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {displayTasks.length === 0 && subs.length === 0 && (
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
                            className="long-pressable flex items-center gap-2 px-2.5 py-2 border-b border-gray-200/60 dark:border-gray-600/40 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors"
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
                                className={`long-pressable flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-600/30 transition-colors ${
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
                                {(child.startDate || child.dueDate) && (
                                  <span className="text-[9px] text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
                                    {child.startDate && child.dueDate
                                      ? `${new Date(child.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}〜${new Date(child.dueDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                                      : child.startDate
                                      ? `${new Date(child.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}〜`
                                      : `〜${new Date(child.dueDate!).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                                    }
                                  </span>
                                )}
                              </div>
                            ))}
                            {/* サブタスク追加 */}
                            {!task.completed && (
                              inlineSubAddParentId === task.id ? (
                                <div className="flex items-center gap-2 px-2 py-1">
                                  <svg className="w-3 h-3 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                                  </svg>
                                  <input
                                    ref={inlineSubAddRef}
                                    type="text"
                                    value={inlineSubAddValue}
                                    onChange={(e) => setInlineSubAddValue(e.target.value)}
                                    onBlur={saveInlineSubAdd}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') { e.preventDefault(); saveInlineSubAdd(); }
                                      if (e.key === 'Escape') { setInlineSubAddParentId(null); setInlineSubAddValue(''); }
                                    }}
                                    placeholder="サブタスク名"
                                    className="flex-1 text-[11px] bg-transparent border-b-2 border-blue-400 focus:outline-none text-gray-600 dark:text-gray-300 py-0.5"
                                    autoFocus
                                  />
                                </div>
                              ) : (
                                <button
                                  onClick={() => startInlineSubAdd(task.id!)}
                                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-[var(--accent)] dark:hover:text-[var(--accent)] transition-colors w-full"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                                  </svg>
                                  追加
                                </button>
                              )
                            )}
                          </div>}
                        </div>
                      );
                    }

                    // 通常タスク
                    return (
                      <div
                        key={task.id}
                        className={`long-pressable flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors ${
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
                        </div>
                        {(task.startDate || task.dueDate) && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
                            {task.startDate && task.dueDate
                              ? `${new Date(task.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}〜${new Date(task.dueDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                              : task.startDate
                              ? `${new Date(task.startDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}〜`
                              : `〜${new Date(task.dueDate!).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                            }
                          </span>
                        )}
                        <div className="w-[14px] h-[14px] flex-shrink-0" />
                        {task.priority === 'high' && !task.completed && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                  {/* サブカテゴリ追加フォーム（グリッド） */}
                  {addingSubTo === parent.id && (
                    <div className="flex gap-2 py-1">
                      <input
                        type="text"
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubCategory(parent.id!); if (e.key === 'Escape') { setAddingSubTo(null); setNewSubName(''); } }}
                        placeholder="サブカテゴリの名前"
                        className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        autoFocus
                      />
                      <button
                        onClick={() => handleAddSubCategory(parent.id!)}
                        className="px-2 py-1.5 text-xs text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                      >
                        追加
                      </button>
                    </div>
                  )}
                  {renderInlineAdd(parent.id!)}
                </div>}
              </div>
            );
          })}

          {/* カテゴリ追加（グリッド） */}
          {showAddCategory ? (
            <div className="col-span-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') { setShowAddCategory(false); setNewCatName(''); } }}
                placeholder="カテゴリ名"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewCatColor(color)}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      newCatColor === color ? 'scale-125 ring-2 ring-offset-2 dark:ring-offset-gray-800 ring-gray-400' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowAddCategory(false); setNewCatName(''); }}
                  className="flex-1 py-2 text-xs text-gray-500 bg-gray-200 dark:bg-gray-600 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddCategory}
                  className="flex-1 py-2 text-xs text-white bg-blue-500 rounded-lg"
                >
                  追加
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddCategory(true)}
              className="col-span-2 flex items-center justify-center gap-1.5 py-3 text-xs text-gray-400 dark:text-gray-500 hover:text-[var(--accent)] dark:hover:text-[var(--accent)] transition-colors rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              カテゴリを追加
            </button>
          )}
        </div>
      ) : (
        /* リスト表示 */
        <div className="space-y-2">
          {parentCategories.map(parent => {
            const subs = getSubCategories(parent.id!);
            const allTasks = getAllTasksForParent(parent.id!);
            const activeCount = allTasks.filter(t => !t.completed).length;
            const isCollapsed = userToggledCategories.has(parent.id!)
              ? collapsedCategories.has(parent.id!)
              : allTasks.length === 0 && subs.length === 0;

            const directTasks = getTasksForCategory(parent.id!);

            return (
              <div key={parent.id} className="rounded-xl overflow-hidden">
                {/* 親カテゴリヘッダー */}
                <button
                  onClick={() => { if (!didCatLongPress.current) toggleCategory(parent.id!); }}
                  {...catLongPressHandlers(parent)}
                  className="long-pressable w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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

                      return (
                        <div key={sub.id} className="mb-1">
                          {/* サブカテゴリヘッダー（授業名） */}
                          <button
                            onClick={() => { if (!didCatLongPress.current) toggleSub(sub.id!); }}
                            {...catLongPressHandlers(sub, true)}
                            className="long-pressable w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                          >
                            <svg
                              className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${isSubCollapsed ? '' : 'rotate-90'}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: parent.color, opacity: 0.6 }} />
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{sub.name}</span>
                            {subActiveCount > 0 && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                                {subActiveCount}
                              </span>
                            )}
                          </button>
                          {!isSubCollapsed && (
                            <div className="pl-6 space-y-1 pb-1">
                              {renderTaskList(subTasks, sub)}
                              {renderInlineAdd(sub.id!)}
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
                    {/* サブカテゴリ追加フォーム */}
                    {addingSubTo === parent.id && (
                      <div className="flex gap-2 px-3 py-2">
                        <input
                          type="text"
                          value={newSubName}
                          onChange={(e) => setNewSubName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubCategory(parent.id!); if (e.key === 'Escape') { setAddingSubTo(null); setNewSubName(''); } }}
                          placeholder="サブカテゴリの名前"
                          className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
                          autoFocus
                        />
                        <button
                          onClick={() => handleAddSubCategory(parent.id!)}
                          className="px-3 py-1.5 text-xs text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                        >
                          追加
                        </button>
                      </div>
                    )}

                    {/* カテゴリ内タスク追加 */}
                    <div className="px-3 pb-1">
                      {renderInlineAdd(parent.id!)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* カテゴリ追加 */}
          {showAddCategory ? (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') { setShowAddCategory(false); setNewCatName(''); } }}
                placeholder="カテゴリ名"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewCatColor(color)}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      newCatColor === color ? 'scale-125 ring-2 ring-offset-2 dark:ring-offset-gray-800 ring-gray-400' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowAddCategory(false); setNewCatName(''); }}
                  className="flex-1 py-2 text-xs text-gray-500 bg-gray-200 dark:bg-gray-600 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddCategory}
                  className="flex-1 py-2 text-xs text-white bg-blue-500 rounded-lg"
                >
                  追加
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddCategory(true)}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-xs text-gray-400 dark:text-gray-500 hover:text-[var(--accent)] dark:hover:text-[var(--accent)] transition-colors rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              カテゴリを追加
            </button>
          )}
        </div>
      )}

      {/* グリッド表示用アクションシート */}
      {menuTask && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/30 z-[9999] flex items-center justify-center animate-overlay" onClick={() => setMenuTask(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm mx-4 p-5 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
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

      {/* カテゴリ用アクションシート */}
      {menuCategory && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/30 z-[9999] flex items-center justify-center animate-overlay" onClick={() => setMenuCategory(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm mx-4 p-5 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4 px-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: menuCategory.color }} />
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{menuCategory.name}</p>
            </div>
            <div className="space-y-1">
              <button
                onClick={() => { setEditingCat({ id: menuCategory.id!, name: menuCategory.name, color: menuCategory.color }); setMenuCategory(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                <span className="text-sm text-gray-700 dark:text-gray-200">編集</span>
              </button>
              <button
                onClick={() => { setManagingSubsCatId(menuCategory.id!); setMenuCategory(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
                <span className="text-sm text-gray-700 dark:text-gray-200">サブカテゴリ管理</span>
              </button>
              <button
                onClick={() => { handleDeleteCategory(menuCategory.id!); setMenuCategory(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                <span className="text-sm text-red-500">削除</span>
              </button>
            </div>
            <button
              onClick={() => setMenuCategory(null)}
              className="w-full mt-3 py-3 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* サブカテゴリ用アクションシート */}
      {menuSubCategory && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/30 z-[9999] flex items-center justify-center animate-overlay" onClick={() => setMenuSubCategory(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm mx-4 p-5 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-4 px-1">{menuSubCategory.name}</p>
            <div className="space-y-1">
              <button
                onClick={() => { setEditingCat({ id: menuSubCategory.id!, name: menuSubCategory.name, color: menuSubCategory.color }); setMenuSubCategory(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                <span className="text-sm text-gray-700 dark:text-gray-200">編集</span>
              </button>
              <button
                onClick={() => { handleDeleteSubCategory(menuSubCategory.id!); setMenuSubCategory(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                <span className="text-sm text-red-500">削除</span>
              </button>
            </div>
            <button
              onClick={() => setMenuSubCategory(null)}
              className="w-full mt-3 py-3 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* サブカテゴリ管理モーダル */}
      {managingSubsCatId !== null && categories && typeof document !== 'undefined' && createPortal(
        (() => {
          const parentCat = categories.find(c => c.id === managingSubsCatId);
          const subsOfCat = categories.filter(c => c.parentId === managingSubsCatId).sort((a, b) => a.order - b.order);
          if (!parentCat) return null;
          return (
            <div className="fixed inset-0 bg-black/30 z-[9999] flex items-center justify-center animate-overlay" onClick={() => { setManagingSubsCatId(null); setEditingSubInManage(null); setNewSubName(''); setAddingSubTo(null); }}>
              <div
                className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm mx-4 p-5 animate-slide-up max-h-[80vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                    <div className="flex items-center gap-2 mb-5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: parentCat.color }} />
                  <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{parentCat.name}</h3>
                  <span className="text-xs text-gray-400 dark:text-gray-500">のサブカテゴリ</span>
                </div>

                {/* サブカテゴリ一覧 */}
                <div className="space-y-2 mb-4">
                  {subsOfCat.length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">サブカテゴリはまだないよ</p>
                  )}
                  {subsOfCat.map(sub => (
                    <div key={sub.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      {editingSubInManage && editingSubInManage.id === sub.id ? (
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={editingSubInManage.name}
                            onChange={(e) => setEditingSubInManage({ ...editingSubInManage!, name: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && editingSubInManage!.name.trim()) {
                                db.categories.update(sub.id!, { name: editingSubInManage!.name.trim() });
                                setEditingSubInManage(null);
                              }
                              if (e.key === 'Escape') setEditingSubInManage(null);
                            }}
                            className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              if (editingSubInManage!.name.trim()) {
                                db.categories.update(sub.id!, { name: editingSubInManage!.name.trim() });
                                setEditingSubInManage(null);
                              }
                            }}
                            className="px-2 py-1 text-xs text-white bg-blue-500 rounded-lg"
                          >
                            保存
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: parentCat.color, opacity: 0.6 }} />
                          <span className="text-sm text-gray-700 dark:text-gray-200 flex-1">{sub.name}</span>
                          <button
                            onClick={() => setEditingSubInManage({ id: sub.id!, name: sub.name })}
                            className="text-xs text-gray-400 hover:text-blue-500 px-2 py-1"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteSubCategory(sub.id!)}
                            className="text-xs text-gray-400 hover:text-red-500 px-2 py-1"
                          >
                            削除
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* 追加フォーム */}
                {addingSubTo === managingSubsCatId ? (
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddSubCategory(managingSubsCatId);
                        if (e.key === 'Escape') { setAddingSubTo(null); setNewSubName(''); }
                      }}
                      placeholder="サブカテゴリ名を入力"
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      autoFocus
                    />
                    <button
                      onClick={() => handleAddSubCategory(managingSubsCatId)}
                      className="px-4 py-2 text-sm text-white bg-blue-500 rounded-xl hover:bg-blue-600"
                    >
                      追加
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingSubTo(managingSubsCatId); setNewSubName(''); }}
                    className="w-full flex items-center justify-center gap-1.5 py-3 text-sm text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors mb-4"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    サブカテゴリを追加
                  </button>
                )}

                <button
                  onClick={() => { setManagingSubsCatId(null); setEditingSubInManage(null); setNewSubName(''); setAddingSubTo(null); }}
                  className="w-full py-3 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* カテゴリ編集モーダル */}
      {editingCat && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/30 z-[9999] flex items-center justify-center animate-overlay" onClick={() => setEditingCat(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm mx-4 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">カテゴリを編集</h3>
            <input
              type="text"
              value={editingCat.name}
              onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditCat(); }}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm mb-3 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
              autoFocus
            />
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setEditingCat({ ...editingCat, color })}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    editingCat.color === color ? 'scale-125 ring-2 ring-offset-2 dark:ring-offset-gray-800 ring-gray-400' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditingCat(null)}
                className="flex-1 py-2 text-xs text-gray-500 bg-gray-200 dark:bg-gray-600 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveEditCat}
                className="flex-1 py-2 text-xs text-white bg-blue-500 rounded-lg"
              >
                保存
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
