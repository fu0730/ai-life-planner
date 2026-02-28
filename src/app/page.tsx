'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import TabBar from '@/components/layout/TabBar';
import TodayView from '@/components/TodayView';
import TasksView from '@/components/TasksView';
import CalendarView from '@/components/CalendarView';
import AddTaskModal from '@/components/AddTaskModal';
import { db } from '@/lib/db';
import { seedDefaultCategories } from '@/lib/seed';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Task } from '@/types';

type Tab = 'today' | 'tasks' | 'calendar';

const tabTitles: Record<Tab, string> = {
  today: '今日',
  tasks: 'タスク',
  calendar: 'カレンダー',
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());

  useEffect(() => {
    seedDefaultCategories();
  }, []);

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

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleOpenModal = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <Header
        title={tabTitles[activeTab]}
        onSettingsClick={() => {/* TODO: 設定画面 */}}
      />

      <main className="pt-14 pb-20 px-4 max-w-lg mx-auto">
        <div className="py-4">
          {activeTab === 'today' && <TodayView onEditTask={handleEditTask} />}
          {activeTab === 'tasks' && <TasksView onEditTask={handleEditTask} />}
          {activeTab === 'calendar' && <CalendarView />}
        </div>
      </main>

      {activeTab !== 'calendar' && (
        <button
          onClick={handleOpenModal}
          className="fixed bottom-20 right-4 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center text-2xl z-10"
        >
          +
        </button>
      )}

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <AddTaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        categories={categories || []}
        editingTask={editingTask}
      />
    </div>
  );
}
