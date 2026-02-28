'use client';

import { useState, useEffect } from 'react';
import type { Task, Category } from '@/types';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id' | 'completed' | 'createdAt' | 'completedAt'>) => void;
  categories: Category[];
  editingTask?: Task | null;
}

export default function AddTaskModal({ isOpen, onClose, onSave, categories, editingTask }: AddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');
  const [categoryId, setCategoryId] = useState<number>(0);
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setMemo(editingTask.memo || '');
      setCategoryId(editingTask.categoryId);
      setPriority(editingTask.priority);
      setDueDate(editingTask.dueDate || '');
    } else {
      setTitle('');
      setMemo('');
      setCategoryId(categories[0]?.id || 0);
      setPriority('medium');
      setDueDate('');
    }
  }, [editingTask, isOpen, categories]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), memo: memo.trim() || undefined, categoryId, priority, dueDate: dueDate || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          {editingTask ? 'タスクを編集' : 'タスクを追加'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タスク名"
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
              autoFocus
            />
          </div>

          <div>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="メモ（任意）"
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm resize-none bg-white dark:bg-gray-700 dark:text-gray-100"
              rows={2}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">カテゴリ</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id!)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    categoryId === cat.id
                      ? 'text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700'
                  }`}
                  style={categoryId === cat.id ? { backgroundColor: cat.color } : {}}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">優先度</label>
            <div className="flex gap-2">
              {([
                { value: 'low', label: '低' },
                { value: 'medium', label: '中' },
                { value: 'high', label: '高' },
              ] as const).map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                    priority === p.value
                      ? p.value === 'high'
                        ? 'bg-red-500 text-white'
                        : p.value === 'medium'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">期限（任意）</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
            />
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
              {editingTask ? '保存' : '追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
