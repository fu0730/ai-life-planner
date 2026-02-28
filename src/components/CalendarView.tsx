'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());

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

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayTasks = getTasksForDate(day);
    const isToday = dateStr === today;

    days.push(
      <div
        key={day}
        className={`min-h-[48px] p-1 rounded-lg text-center ${
          isToday ? 'bg-blue-50 ring-2 ring-blue-300' : ''
        }`}
      >
        <span className={`text-xs ${isToday ? 'font-bold text-blue-600' : 'text-gray-600'}`}>
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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 text-gray-500 hover:text-gray-700">
          ←
        </button>
        <h2 className="text-base font-bold text-gray-800">
          {year}年{month + 1}月
        </h2>
        <button onClick={nextMonth} className="p-2 text-gray-500 hover:text-gray-700">
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
          <div key={d} className="text-center text-xs text-gray-400 py-1 font-medium">
            {d}
          </div>
        ))}
        {days}
      </div>
    </div>
  );
}
