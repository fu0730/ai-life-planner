'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Routine, TimeBlock } from '@/types';

interface AddRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (routine: Omit<Routine, 'id' | 'createdAt'>) => void;
  editingRoutine?: Routine | null;
}

const BLOCK_OPTIONS: { value: TimeBlock; label: string; emoji: string }[] = [
  { value: 'morning', label: '朝', emoji: '🌅' },
  { value: 'forenoon', label: '午前', emoji: '🌤' },
  { value: 'afternoon', label: '午後', emoji: '🌇' },
  { value: 'night', label: '夜', emoji: '🌙' },
];

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export default function AddRoutineModal({ isOpen, onClose, onSave, editingRoutine }: AddRoutineModalProps) {
  const [title, setTitle] = useState('');
  const [block, setBlock] = useState<TimeBlock>('morning');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  useEffect(() => {
    if (editingRoutine) {
      setTitle(editingRoutine.title);
      setBlock(editingRoutine.block);
      setEstimatedMinutes(editingRoutine.estimatedMinutes?.toString() || '');
      setDays(editingRoutine.days);
    } else {
      setTitle('');
      setBlock('morning');
      setEstimatedMinutes('');
      setDays([0, 1, 2, 3, 4, 5, 6]);
    }
  }, [editingRoutine, isOpen]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const toggleDay = (day: number) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || days.length === 0) return;
    onSave({
      title: title.trim(),
      block,
      estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
      days,
      order: 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center animate-overlay" role="dialog" aria-modal="true" aria-labelledby="routine-modal-title" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 max-h-[85vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="routine-modal-title" className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          {editingRoutine ? 'ルーティンを編集' : 'ルーティンを追加'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ルーティン名"
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">時間帯</label>
            <div className="flex gap-2">
              {BLOCK_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setBlock(opt.value)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                    block === opt.value
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">目安時間（分、任意）</label>
            <input
              type="number"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              placeholder="例: 15"
              min="1"
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">曜日</label>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`w-10 h-10 rounded-full text-xs font-medium transition-all ${
                    days.includes(i)
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 py-3 text-sm text-white bg-blue-500 rounded-xl hover:bg-blue-600 transition-colors font-medium"
            >
              {editingRoutine ? '保存' : '追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
