'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

interface ReflectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReflectionModal({ isOpen, onClose }: ReflectionModalProps) {
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const todayTasks = useLiveQuery(
    () => db.tasks.filter((t) => {
      if (t.completedAt?.split('T')[0] === today) return true;
      if (t.dueDate === today) return true;
      return false;
    }).toArray(),
    [today]
  );

  const existingReflection = useLiveQuery(
    () => db.reflections.where('date').equals(today).first(),
    [today]
  );

  useEffect(() => {
    if (existingReflection?.note) {
      setNote(existingReflection.note);
    }
  }, [existingReflection]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !todayTasks) return null;

  const completed = todayTasks.filter((t) => t.completed).length;
  const total = todayTasks.length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  const handleSave = async () => {
    if (existingReflection) {
      await db.reflections.update(existingReflection.id!, {
        note: note.trim() || undefined,
        completedCount: completed,
        totalCount: total,
      });
    } else {
      await db.reflections.add({
        date: today,
        completedCount: completed,
        totalCount: total,
        note: note.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
    }
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center animate-overlay" role="dialog" aria-modal="true" aria-labelledby="reflection-modal-title" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-sm mx-4 rounded-2xl p-6 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {saved ? (
          <div className="text-center py-8 animate-fade-in">
            <p className="text-4xl mb-3">🌙</p>
            <p className="text-gray-700 dark:text-gray-300 font-bold">おつかれさま！</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">ゆっくり休んでね</p>
          </div>
        ) : (
          <>
            <h2 id="reflection-modal-title" className="text-lg font-bold text-gray-800 dark:text-gray-100 text-center mb-4">今日のふりかえり</h2>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-4 text-center">
              <p className="text-3xl font-bold text-blue-500 mb-1">{completed}/{total}</p>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 mb-2">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: percentage === 100 ? '#10B981' : '#3B82F6',
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{percentage}% 達成</p>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">
                今日の自分に一言（書かなくてもOK）
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="がんばった！ / 疲れた〜 / 明日はもっとやるぞ"
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm resize-none bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                スキップ
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 text-sm text-white bg-blue-500 rounded-xl hover:bg-blue-600 transition-colors font-medium"
              >
                保存
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
