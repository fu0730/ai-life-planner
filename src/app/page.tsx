'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import TabBar from '@/components/layout/TabBar';
import TodayView from '@/components/TodayView';
import TasksView from '@/components/TasksView';
import CalendarView from '@/components/CalendarView';
import AddTaskModal from '@/components/AddTaskModal';
import AddRoutineModal from '@/components/AddRoutineModal';
import QuickAddPanel from '@/components/QuickAddPanel';
import SettingsView from '@/components/SettingsView';
import ProfileView from '@/components/ProfileView';
import ChatView from '@/components/ChatView';
import SetupFlow from '@/components/SetupFlow';
import { scheduleReminder, cancelReminder } from '@/lib/push';
import { db } from '@/lib/db';
import { seedDefaultCategories } from '@/lib/seed';
import { getSettings } from '@/lib/settings';
import { useLiveQuery } from 'dexie-react-hooks';
import ListView from '@/components/ListView';
import AddListModal from '@/components/AddListModal';
import type { Task, Routine, Settings, CheckList, ListType } from '@/types';

type Tab = 'today' | 'tasks' | 'lists';

const tabTitles: Record<Tab, string> = {
  today: '今日',
  tasks: 'タスク',
  lists: 'リスト',
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialMessage, setChatInitialMessage] = useState<string | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [parentTask, setParentTask] = useState<Task | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [settings, setSettings] = useState<Settings | undefined>(undefined);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<CheckList | null>(null);

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

      // リマインド通知のスケジュール更新
      if (taskData.reminder && taskData.dueDate) {
        scheduleReminder(editingTask.id, taskData.title, taskData.dueDate, taskData.reminder);
      } else {
        cancelReminder(editingTask.id);
      }

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

      // リマインド通知のスケジュール登録
      if (taskData.reminder && taskData.dueDate) {
        scheduleReminder(parentId as number, taskData.title, taskData.dueDate, taskData.reminder);
      }

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
    if (activeTab === 'lists') {
      setEditingList(null);
      setIsListModalOpen(true);
    } else {
      setIsQuickAddOpen(true);
    }
  };

  const handleSaveList = async (data: { name: string; type: ListType; color: string; categoryId: number }) => {
    if (editingList?.id) {
      await db.checkLists.update(editingList.id, data);
    } else {
      const count = await db.checkLists.count();
      await db.checkLists.add({
        ...data,
        order: count,
        createdAt: new Date().toISOString(),
      });
    }
    setEditingList(null);
  };

  const handleEditList = (list: CheckList) => {
    setEditingList(list);
    setIsListModalOpen(true);
  };

  const handleDeleteList = async (listId: number) => {
    await db.checkListItems.where('listId').equals(listId).delete();
    await db.purchaseHistory.where('listId').equals(listId).delete();
    await db.checkLists.delete(listId);
  };

  const handleQuickAdd = async (data: { title: string; categoryId: number; startDate?: string; dueDate?: string }) => {
    await db.tasks.add({
      title: data.title,
      categoryId: data.categoryId,
      priority: 'medium',
      startDate: data.startDate,
      dueDate: data.dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen bg-[var(--background)] transition-colors">
      <Header
        title={tabTitles[activeTab]}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onProfileClick={() => setIsProfileOpen(true)}
        onCalendarClick={() => setIsCalendarOpen(true)}
      />

      <main className="pt-14 pb-20 px-4 max-w-lg mx-auto">
        <div className="py-4">
          <div className={activeTab === 'today' ? '' : 'hidden'}>
            <TodayView
              onEditTask={handleEditTask}
              onEditRoutine={handleEditRoutine}
              onAddSubtask={handleAddSubtask}
              settings={settings}
            />
          </div>
          <div className={activeTab === 'tasks' ? '' : 'hidden'}>
            <TasksView onEditTask={handleEditTask} onAddSubtask={handleAddSubtask} settings={settings} />
          </div>
          <div className={activeTab === 'lists' ? '' : 'hidden'}>
            <ListView
              onEditList={handleEditList}
              onDeleteList={handleDeleteList}
            />
          </div>
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

      <div className="fixed bottom-20 right-4 z-10">
          <button
            onClick={handleOpenAddMenu}
            aria-label={activeTab === 'lists' ? 'リストを作成' : 'タスクを追加'}
            className="w-12 h-12 bg-[var(--accent)] text-white rounded-full hover:opacity-90 active:scale-95 transition-all flex items-center justify-center"
            style={{ boxShadow: '0 2px 12px rgba(59,130,246,0.3)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
      </div>

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

      <ProfileView
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onOpenChat={(message) => {
          setIsProfileOpen(false);
          setChatInitialMessage(message);
          setIsChatOpen(true);
        }}
      />


      <ChatView
        isOpen={isChatOpen}
        onClose={() => {
          setIsChatOpen(false);
          setChatInitialMessage(undefined);
        }}
        initialMessage={chatInitialMessage}
      />

      <CalendarView
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
      />

      <QuickAddPanel
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onAdd={handleQuickAdd}
        onOpenRoutineModal={() => {
          setEditingRoutine(null);
          setIsRoutineModalOpen(true);
        }}
        categories={categories || []}
      />

      <AddListModal
        isOpen={isListModalOpen}
        onClose={() => {
          setIsListModalOpen(false);
          setEditingList(null);
        }}
        onSave={handleSaveList}
        editingList={editingList}
        categories={(categories || []).filter(c => c.type === 'checklist')}
      />

    </div>
  );
}
