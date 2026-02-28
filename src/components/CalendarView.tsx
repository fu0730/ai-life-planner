'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const tasks = useLiveQuery(() => db.tasks.filter((t) => !!t.dueDate).toArray());
  const categories = useLiveQuery(() => db.categories.toArray());

  if (!tasks || !categories) {
    return <div className="flex items-center justify-center py-12 text-gray-400 text-sm">読み込み中...</div>;
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const getTasksForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.filter((t) => t.dueDate === dateStr);
  };

  const getCategoryColor = (categoryId: number) => {
    return categories.find((c) => c.id === categoryId)?.color || '#ccc';
  };

  const prevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); };
  const nextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); };

  const selectedDateTasks = selectedDay ? getTasksForDate(selectedDay) : [];

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayTasks = getTasksForDate(day);
    const isToday = dateStr === today;
    const isSelected = selectedDay === day;

    days.push(
      <button
        key={day}
        onClick={() => setSelectedDay(day === selectedDay ? null : day)}
        className={`min-h-[48px] p-1 rounded-lg text-center transition-all ${
          isSelected ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400' :
          isToday ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
      >
        <span className={`text-xs ${
          isToday ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
        }`}>
          {day}
        </span>
        <div className="flex flex-wrap justify-center gap-0.5 mt-0.5">
          {dayTasks.slice(0, 3).map((t) => (
            <div
              key={t.id}
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: getCategoryColor(t.categoryId) }}
            />
          ))}
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700">
          ←
        </button>
        <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">
          {year}年{month + 1}月
        </h2>
        <button onClick={nextMonth} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700">
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
          <div key={d} className="text-center text-xs text-gray-400 dark:text-gray-500 py-1 font-medium">
            {d}
          </div>
        ))}
        {days}
      </div>

      {/* 選択した日のタスク */}
      {selectedDay && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {month + 1}月{selectedDay}日のタスク
          </h3>
          {selectedDateTasks.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">タスクはないよ</p>
          ) : (
            <div className="space-y-2">
              {selectedDateTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getCategoryColor(t.categoryId) }}
                  />
                  <span className={`text-sm ${t.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {t.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
