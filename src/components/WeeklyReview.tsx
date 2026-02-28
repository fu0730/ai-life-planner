'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

interface WeeklyReviewProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WeeklyReview({ isOpen, onClose }: WeeklyReviewProps) {
  const reflections = useLiveQuery(() => db.reflections.orderBy('date').reverse().toArray());
  const tasks = useLiveQuery(() => db.tasks.toArray());

  if (!isOpen || !reflections || !tasks) return null;

  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const weekStr = weekAgo.toISOString().split('T')[0];
  const monthStr = monthAgo.toISOString().split('T')[0];

  const thisWeekReflections = reflections.filter((r) => r.date >= weekStr);
  const thisMonthReflections = reflections.filter((r) => r.date >= monthStr);

  const weekCompleted = thisWeekReflections.reduce((sum, r) => sum + r.completedCount, 0);
  const weekTotal = thisWeekReflections.reduce((sum, r) => sum + r.totalCount, 0);
  const monthCompleted = thisMonthReflections.reduce((sum, r) => sum + r.completedCount, 0);
  const monthTotal = thisMonthReflections.reduce((sum, r) => sum + r.totalCount, 0);

  const weekPercentage = weekTotal === 0 ? 0 : Math.round((weekCompleted / weekTotal) * 100);
  const monthPercentage = monthTotal === 0 ? 0 : Math.round((monthCompleted / monthTotal) * 100);

  const recentNotes = reflections.filter((r) => r.note).slice(0, 7);

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-sm mx-4 rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 text-center mb-6">ふりかえり</h2>

        {/* 今週 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">今週</h3>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{weekCompleted}</span>
            <span className="text-sm text-blue-500 dark:text-blue-400 mb-1">個達成 / {weekTotal}個中</span>
          </div>
          <div className="w-full bg-blue-100 dark:bg-blue-900/40 rounded-full h-2">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${weekPercentage}%` }}
            />
          </div>
          <p className="text-xs text-blue-500 dark:text-blue-400 mt-1 text-right">{weekPercentage}%</p>
        </div>

        {/* 今月 */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">今月</h3>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-bold text-green-600 dark:text-green-400">{monthCompleted}</span>
            <span className="text-sm text-green-500 dark:text-green-400 mb-1">個達成 / {monthTotal}個中</span>
          </div>
          <div className="w-full bg-green-100 dark:bg-green-900/40 rounded-full h-2">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${monthPercentage}%` }}
            />
          </div>
          <p className="text-xs text-green-500 dark:text-green-400 mt-1 text-right">{monthPercentage}%</p>
        </div>

        {/* 過去の一言 */}
        {recentNotes.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">最近の一言</h3>
            <div className="space-y-2">
              {recentNotes.map((r) => (
                <div key={r.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                    {new Date(r.date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{r.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
