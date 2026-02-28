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
  const [editingTask, setEditingTask] = useState<Task | null>(null);
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

  // ダークモード適用
  useEffect(() => {
    if (settings) {
      document.documentElement.classList.toggle('dark', settings.theme === 'dark');
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

  const handleSaveTask = async (
    taskData: Omit<Task, 'id' | 'completed' | 'createdAt' | 'completedAt'>
  ) => {
    if (editingTask?.id) {
      await db.tasks.update(editingTask.id, taskData);
    } else {
      await db.tasks.add({
        ...taskData,
        completed: false,
        createdAt: new Date().toISOString(),
      });
    }
    setEditingTask(null);
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
      setIsTaskModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-gray-900 transition-colors">
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
              settings={settings}
            />
          )}
          {activeTab === 'tasks' && <TasksView onEditTask={handleEditTask} settings={settings} />}
          {activeTab === 'calendar' && <CalendarView />}
        </div>
      </main>

      {activeTab !== 'calendar' && (
        <div ref={addMenuRef} className="fixed bottom-20 right-4 z-10">
          {/* 追加メニュー（今日タブ時） */}
          {isAddMenuOpen && (
            <div className="absolute bottom-16 right-0 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-2 min-w-[160px]">
              <button
                onClick={() => {
                  setIsAddMenuOpen(false);
                  setEditingTask(null);
                  setIsTaskModalOpen(true);
                }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <span>📋</span> タスクを追加
              </button>
              <div className="h-px bg-gray-100 dark:bg-gray-700" />
              <button
                onClick={() => {
                  setIsAddMenuOpen(false);
                  setEditingRoutine(null);
                  setIsRoutineModalOpen(true);
                }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <span>🔄</span> ルーティンを追加
              </button>
            </div>
          )}

          <button
            onClick={handleOpenAddMenu}
            className={`w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center text-2xl ${
              isAddMenuOpen ? 'rotate-45' : ''
            }`}
          >
            +
          </button>
        </div>
      )}

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <AddTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        categories={categories || []}
        editingTask={editingTask}
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
    </div>
  );
}
