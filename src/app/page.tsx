'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/layout/Header';
import TabBar from '@/components/layout/TabBar';
import TodayView from '@/components/TodayView';
import TasksView from '@/components/TasksView';
import CalendarView from '@/components/CalendarView';
import AddTaskModal from '@/components/AddTaskModal';
import AddRoutineModal from '@/components/AddRoutineModal';
import SettingsView from '@/components/SettingsView';
import ReflectionModal from '@/components/ReflectionModal';
import WeeklyReview from '@/components/WeeklyReview';
import ChatView from '@/components/ChatView';
import SetupFlow from '@/components/SetupFlow';
import { db } from '@/lib/db';
import { seedDefaultCategories } from '@/lib/seed';
import { getSettings } from '@/lib/settings';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Task, Routine, Settings } from '@/types';

type Tab = 'today' | 'tasks' | 'calendar';

const tabTitles: Record<Tab, string> = {
  today: '今日',
  tasks: 'タスク',
  calendar: 'カレンダー',
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReflectionOpen, setIsReflectionOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [parentTask, setParentTask] = useState<Task | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [settings, setSettings] = useState<Settings | undefined>(undefined);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());

  // settingsの監視
  const settingsFromDb = useLiveQuery(() => db.settings.toCollection().first());

  useEffect(() => {
    seedDefaultCategories();
    getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (settingsFromDb) {
      setSettings(settingsFromDb);
    }
  }, [settingsFromDb]);

  // ダークモード適用 + themeColor切替
  useEffect(() => {
    if (settings) {
      const isDark = settings.theme === 'dark';
      document.documentElement.classList.toggle('dark', isDark);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', isDark ? '#111827' : '#3b82f6');
      }
    }
  }, [settings]);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    if (isAddMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isAddMenuOpen]);

  const handleSetupComplete = () => {
    getSettings().then(setSettings);
  };

  // セットアップ未完了なら表示
  if (settings && !settings.setupCompleted) {
    return <SetupFlow onComplete={handleSetupComplete} />;
  }

  const handleSaveTask = async (
    taskData: Omit<Task, 'id' | 'completed' | 'createdAt' | 'completedAt'>,
    subtasks?: { id?: number; title: string; startDate?: string; dueDate?: string }[]
  ) => {
    if (editingTask?.id) {
      await db.tasks.update(editingTask.id, taskData);

      // サブタスクの更新処理
      if (subtasks !== undefined) {
        const existing = await db.tasks.where('parentId').equals(editingTask.id).toArray();
        const existingIds = existing.map(s => s.id!);
        const keptIds = subtasks.filter(s => s.id).map(s => s.id!);

        // 削除されたサブタスク
        const toDelete = existingIds.filter(id => !keptIds.includes(id));
        if (toDelete.length > 0) {
          await db.tasks.bulkDelete(toDelete);
        }

        // 既存サブタスクの更新 & 新規追加
        const now = new Date().toISOString();
        for (const sub of subtasks) {
          if (sub.id) {
            await db.tasks.update(sub.id, { title: sub.title, startDate: sub.startDate, dueDate: sub.dueDate });
          } else {
            await db.tasks.add({
              title: sub.title,
              categoryId: taskData.categoryId,
              priority: taskData.priority,
              startDate: sub.startDate,
              dueDate: sub.dueDate,
              parentId: editingTask.id,
              completed: false,
              createdAt: now,
            });
          }
        }
      }
    } else {
      const parentId = await db.tasks.add({
        ...taskData,
        completed: false,
        createdAt: new Date().toISOString(),
      });
      // サブタスクも一緒に作成
      if (subtasks && subtasks.length > 0) {
        const now = new Date().toISOString();
        await db.tasks.bulkAdd(
          subtasks.map(sub => ({
            title: sub.title,
            categoryId: taskData.categoryId,
            priority: taskData.priority,
            startDate: sub.startDate,
            dueDate: sub.dueDate,
            parentId: parentId as number,
            completed: false,
            createdAt: now,
          }))
        );
      }
    }
    setEditingTask(null);
    setParentTask(null);
  };

  const handleSaveRoutine = async (
    routineData: Omit<Routine, 'id' | 'createdAt'>
  ) => {
    if (editingRoutine?.id) {
      await db.routines.update(editingRoutine.id, routineData);
    } else {
      // orderは既存のルーティン数で自動設定
      const count = await db.routines.where('block').equals(routineData.block).count();
      await db.routines.add({
        ...routineData,
        order: count,
        createdAt: new Date().toISOString(),
      });
    }
    setEditingRoutine(null);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setParentTask(null);
    setIsTaskModalOpen(true);
  };

  const handleAddSubtask = (parent: Task) => {
    setEditingTask(null);
    setParentTask(parent);
    setIsTaskModalOpen(true);
  };

  const handleEditRoutine = (routine: Routine) => {
    setEditingRoutine(routine);
    setIsRoutineModalOpen(true);
  };

  const handleOpenAddMenu = () => {
    if (activeTab === 'today') {
      setIsAddMenuOpen((prev) => !prev);
    } else {
      // タスクタブでは直接タスク追加
      setEditingTask(null);
      setParentTask(null);
      setIsTaskModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] transition-colors">
      <Header
        title={tabTitles[activeTab]}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onReflectionClick={() => setIsReflectionOpen(true)}
        onReviewClick={() => setIsReviewOpen(true)}
      />

      <main className="pt-14 pb-20 px-4 max-w-lg mx-auto">
        <div className="py-4">
          {activeTab === 'today' && (
            <TodayView
              onEditTask={handleEditTask}
              onEditRoutine={handleEditRoutine}
              onAddSubtask={handleAddSubtask}
              settings={settings}
            />
          )}
          {activeTab === 'tasks' && <TasksView onEditTask={handleEditTask} onAddSubtask={handleAddSubtask} settings={settings} />}
          {activeTab === 'calendar' && <CalendarView />}
        </div>
      </main>

      {/* AIボタン（今日タブ時のみ） */}
      {activeTab === 'today' && (
        <button
          onClick={() => setIsChatOpen(true)}
          aria-label="AIアシスタントを開く"
          className="fixed bottom-20 left-4 z-10 w-11 h-11 bg-purple-500 text-white rounded-full hover:bg-purple-600 active:scale-95 transition-all flex items-center justify-center"
          style={{ boxShadow: '0 2px 12px rgba(139,92,246,0.3)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        </button>
      )}

      {activeTab !== 'calendar' && (
        <div ref={addMenuRef} className="fixed bottom-20 right-4 z-10">
          {/* 追加メニュー（今日タブ時） */}
          {isAddMenuOpen && (
            <div className="absolute bottom-14 right-0 bg-white dark:bg-gray-800 rounded-2xl border border-[var(--border)] overflow-hidden mb-2 min-w-[160px]"
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
            >
              <button
                onClick={() => {
                  setIsAddMenuOpen(false);
                  setEditingTask(null);
                  setParentTask(null);
                  setIsTaskModalOpen(true);
                }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-2.5"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
                タスクを追加
              </button>
              <div className="h-px bg-gray-100 dark:bg-gray-700/50" />
              <button
                onClick={() => {
                  setIsAddMenuOpen(false);
                  setEditingRoutine(null);
                  setIsRoutineModalOpen(true);
                }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-2.5"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992" />
                </svg>
                ルーティンを追加
              </button>
            </div>
          )}

          <button
            onClick={handleOpenAddMenu}
            aria-label={isAddMenuOpen ? 'メニューを閉じる' : '追加メニューを開く'}
            className={`w-12 h-12 bg-[var(--accent)] text-white rounded-full hover:opacity-90 active:scale-95 transition-all flex items-center justify-center ${
              isAddMenuOpen ? 'rotate-45' : ''
            }`}
            style={{ boxShadow: '0 2px 12px rgba(59,130,246,0.3)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      )}

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <AddTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
          setParentTask(null);
        }}
        onSave={handleSaveTask}
        categories={categories || []}
        editingTask={editingTask}
        parentTask={parentTask}
      />

      <AddRoutineModal
        isOpen={isRoutineModalOpen}
        onClose={() => {
          setIsRoutineModalOpen(false);
          setEditingRoutine(null);
        }}
        onSave={handleSaveRoutine}
        editingRoutine={editingRoutine}
      />

      <SettingsView
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
      />

      <ReflectionModal
        isOpen={isReflectionOpen}
        onClose={() => setIsReflectionOpen(false)}
      />

      <WeeklyReview
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
      />

      <ChatView
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
}
