'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Task } from '@/types';

const MAX_LANES = 4;

interface TaskBar {
  task: Task;
  startCol: number;
  endCol: number;
  isTaskStart: boolean;
  isTaskEnd: boolean;
}

interface TaskBarWithLane extends TaskBar {
  lane: number;
}

// 重ならないバーを同じレーンに配置（Googleカレンダー方式）
const assignLanes = (bars: TaskBar[]): TaskBarWithLane[] => {
  const sorted = [...bars].sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol;
    return (b.endCol - b.startCol) - (a.endCol - a.startCol);
  });

  const laneEnds: number[] = []; // 各レーンが占有されている最後の列+1
  const result: TaskBarWithLane[] = [];

  for (const bar of sorted) {
    let lane = -1;
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] <= bar.startCol) {
        lane = i;
        laneEnds[i] = bar.endCol + 1;
        break;
      }
    }
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(bar.endCol + 1);
    }
    result.push({ ...bar, lane });
  }

  return result;
};

interface CalendarViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CalendarView({ isOpen, onClose }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const tasks = useLiveQuery(() => db.tasks.filter((t) => !!t.dueDate || !!t.startDate).toArray());
  const categories = useLiveQuery(() => db.categories.toArray());

  if (!isOpen) return null;

  if (!tasks || !categories) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6">
          <p className="text-gray-400 text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const getCategoryColor = (categoryId: number) => {
    return categories.find((c) => c.id === categoryId)?.color || '#ccc';
  };

  const toDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // 週ごとにグループ化
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) currentWeek.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  // 背景色タスクとバータスクを分離
  const bgTasks = tasks.filter(t => t.calendarDisplay === 'background');
  const barTasks = tasks.filter(t => t.calendarDisplay !== 'background');

  // 指定日の背景色を取得（1色のみ）
  const getBgColorForDate = (day: number): string | null => {
    const dateStr = toDateStr(day);
    for (const t of bgTasks) {
      const start = t.startDate || t.dueDate;
      const end = t.dueDate || t.startDate;
      if (!start || !end) continue;
      if (dateStr >= start && dateStr <= end) {
        return getCategoryColor(t.categoryId);
      }
    }
    return null;
  };

  // 各週のタスクバーを計算（背景色タスクは除外）
  const getTaskBarsForWeek = (week: (number | null)[]) => {
    const validDays = week
      .map((d, i) => ({ day: d, col: i }))
      .filter((x): x is { day: number; col: number } => x.day !== null);
    if (validDays.length === 0) return [];

    const weekStartDate = toDateStr(validDays[0].day);
    const weekEndDate = toDateStr(validDays[validDays.length - 1].day);

    const bars: TaskBar[] = [];

    for (const t of barTasks) {
      const taskStart = t.startDate || t.dueDate;
      const taskEnd = t.dueDate || t.startDate;
      if (!taskStart || !taskEnd) continue;
      if (taskStart > weekEndDate || taskEnd < weekStartDate) continue;

      let startCol = validDays[0].col;
      for (const { day, col } of validDays) {
        if (toDateStr(day) >= taskStart) {
          startCol = col;
          break;
        }
      }

      let endCol = validDays[validDays.length - 1].col;
      for (let i = validDays.length - 1; i >= 0; i--) {
        if (toDateStr(validDays[i].day) <= taskEnd) {
          endCol = validDays[i].col;
          break;
        }
      }

      bars.push({
        task: t,
        startCol,
        endCol,
        isTaskStart: taskStart >= weekStartDate && taskStart <= weekEndDate,
        isTaskEnd: taskEnd >= weekStartDate && taskEnd <= weekEndDate,
      });
    }

    return bars;
  };

  // 日付指定でタスク取得（詳細パネル用）
  const getTasksForDate = (day: number) => {
    const dateStr = toDateStr(day);
    return tasks.filter((t) => {
      if (t.startDate && t.dueDate) return dateStr >= t.startDate && dateStr <= t.dueDate;
      return t.dueDate === dateStr || t.startDate === dateStr;
    });
  };

  const prevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); };
  const nextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); };
  const selectedDateTasks = selectedDay ? getTasksForDate(selectedDay) : [];

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center animate-overlay" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 w-full max-w-lg mx-4 rounded-2xl max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-5 py-3 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">カレンダー</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 月ナビゲーション */}
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700">←</button>
            <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">{year}年{month + 1}月</h2>
            <button onClick={nextMonth} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700">→</button>
          </div>

          {/* カレンダー */}
          <div>
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7">
          {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
            <div key={d} className="text-center text-xs text-gray-400 dark:text-gray-500 py-1 font-medium">{d}</div>
          ))}
        </div>

        {/* 週ごとの描画 */}
        {weeks.map((week, weekIdx) => {
          const bars = getTaskBarsForWeek(week);
          const barsWithLanes = assignLanes(bars);
          const totalLanes = barsWithLanes.length > 0
            ? Math.max(...barsWithLanes.map(b => b.lane)) + 1
            : 0;
          const displayLanes = Math.min(totalLanes, MAX_LANES);

          // 日ごとのオーバーフロー件数を計算
          const overflowPerDay = new Array(7).fill(0);
          for (const bar of barsWithLanes) {
            if (bar.lane >= MAX_LANES) {
              for (let col = bar.startCol; col <= bar.endCol; col++) {
                overflowPerDay[col]++;
              }
            }
          }

          return (
            <div key={weekIdx}>
              {/* 日付行 */}
              <div className="grid grid-cols-7">
                {week.map((day, colIdx) => {
                  if (day === null) return <div key={`e-${colIdx}`} className="min-h-[28px]" />;
                  const dateStr = toDateStr(day);
                  const isToday = dateStr === today;
                  const isSelected = selectedDay === day;
                  const bgColor = getBgColorForDate(day);
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                      className={`min-h-[28px] py-0.5 text-center transition-all ${
                        isSelected ? 'ring-2 ring-blue-400 ring-inset' :
                        !bgColor && isToday ? 'bg-blue-50 dark:bg-blue-900/20' :
                        !bgColor ? 'hover:bg-gray-50 dark:hover:bg-gray-800' : ''
                      }`}
                      style={bgColor ? { backgroundColor: `${bgColor}20` } : undefined}
                    >
                      <span className={`text-xs inline-flex items-center justify-center w-6 h-6 ${
                        isSelected ? 'bg-blue-500 text-white rounded-full font-bold' :
                        isToday ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {day}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* タスクバー（レーン管理） */}
              {displayLanes > 0 && (
                <div className="pb-1 space-y-px">
                  {Array.from({ length: displayLanes }).map((_, laneIdx) => {
                    const laneBars = barsWithLanes.filter(b => b.lane === laneIdx);
                    return (
                      <div key={laneIdx} className="grid grid-cols-7">
                        {laneBars.map((bar) => (
                          <div
                            key={`${bar.task.id}-${weekIdx}`}
                            className={`h-[18px] flex items-center px-1 text-white text-[10px] leading-none font-medium truncate ${
                              bar.isTaskStart && bar.isTaskEnd ? 'rounded' :
                              bar.isTaskStart ? 'rounded-l' :
                              bar.isTaskEnd ? 'rounded-r' : ''
                            } ${bar.task.completed ? 'opacity-50' : ''}`}
                            style={{
                              gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`,
                              backgroundColor: getCategoryColor(bar.task.categoryId),
                            }}
                          >
                            {bar.task.title}
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {/* 日ごとの「+N件」表示 */}
                  {overflowPerDay.some(n => n > 0) && (
                    <div className="grid grid-cols-7">
                      {overflowPerDay.map((count, col) => (
                        <div key={col} className="text-center">
                          {count > 0 ? (
                            <button
                              onClick={() => {
                                const day = week[col];
                                if (day !== null) setSelectedDay(day);
                              }}
                              className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              +{count}件
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

          {/* 選択した日のタスク詳細 */}
          {selectedDay && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                {month + 1}月{selectedDay}日のタスク
              </h3>
              {selectedDateTasks.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">タスクはないよ</p>
              ) : (
                <div className="space-y-2.5">
                  {selectedDateTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(t.categoryId) }} />
                      <span className={`text-sm ${t.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {t.title}
                      </span>
                      {t.startDate && t.dueDate && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto flex-shrink-0">
                          {t.startDate.slice(5).replace('-', '/')}〜{t.dueDate.slice(5).replace('-', '/')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
