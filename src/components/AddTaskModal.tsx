'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/db';
import type { Task, Category, TimeBlock } from '@/types';

const BLOCK_OPTIONS: { value: TimeBlock | ''; label: string; emoji: string }[] = [
  { value: '', label: '未設定', emoji: '📌' },
  { value: 'morning', label: '朝', emoji: '🌅' },
  { value: 'forenoon', label: '午前', emoji: '🌤' },
  { value: 'afternoon', label: '午後', emoji: '🌇' },
  { value: 'night', label: '夜', emoji: '🌙' },
];

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id' | 'completed' | 'createdAt' | 'completedAt'>, subtasks?: { id?: number; title: string; startDate?: string; dueDate?: string }[]) => void;
  categories: Category[];
  editingTask?: Task | null;
  parentTask?: Task | null;
}

export default function AddTaskModal({ isOpen, onClose, onSave, categories, editingTask, parentTask }: AddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');
  const [categoryId, setCategoryId] = useState<number>(0);
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [block, setBlock] = useState<TimeBlock | ''>('');
  const [subtasks, setSubtasks] = useState<{ id?: number; title: string; startDate: string; dueDate: string }[]>([]);

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setMemo(editingTask.memo || '');
      setCategoryId(editingTask.categoryId);
      setPriority(editingTask.priority);
      setStartDate(editingTask.startDate || '');
      setDueDate(editingTask.dueDate || '');
      setBlock(editingTask.block || '');
      // 親タスク編集時は既存サブタスクを読み込む
      if (editingTask.id !== undefined && !editingTask.parentId) {
        db.tasks.where('parentId').equals(editingTask.id).toArray().then(existing => {
          setSubtasks(existing.map(s => ({ id: s.id, title: s.title, startDate: s.startDate || '', dueDate: s.dueDate || '' })));
        });
      } else {
        setSubtasks([]);
      }
    } else if (parentTask) {
      setTitle('');
      setMemo('');
      setCategoryId(parentTask.categoryId);
      setPriority(parentTask.priority);
      setStartDate('');
      setDueDate(parentTask.dueDate || '');
      setBlock(parentTask.block || '');
      setSubtasks([]);
    } else {
      setTitle('');
      setMemo('');
      setCategoryId(categories[0]?.id || 0);
      setPriority('medium');
      setStartDate('');
      setDueDate('');
      setBlock('');
      setSubtasks([]);
    }
  }, [editingTask, parentTask, isOpen, categories]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const validSubtasks = subtasks
      .filter(s => s.title.trim())
      .map(s => ({ id: s.id, title: s.title.trim(), startDate: s.startDate || undefined, dueDate: s.dueDate || undefined }));
    onSave(
      { title: title.trim(), memo: memo.trim() || undefined, categoryId, priority, startDate: startDate || undefined, dueDate: dueDate || undefined, block: block || undefined, parentId: parentTask?.id },
      !parentTask && !(editingTask?.parentId) ? validSubtasks : undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center animate-overlay" role="dialog" aria-modal="true" aria-labelledby="task-modal-title" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 max-h-[85vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="task-modal-title" className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          {editingTask ? 'タスクを編集' : parentTask ? 'サブタスクを追加' : 'タスクを追加'}
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
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">時間帯（任意）</label>
            <div className="flex flex-wrap gap-2">
              {BLOCK_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setBlock(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
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
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">期間（任意）</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="開始日"
                className="flex-1 px-3 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
              />
              <span className="text-gray-400 dark:text-gray-500 text-sm flex-shrink-0">〜</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="期限"
                className="flex-1 px-3 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          {/* サブタスク入力（サブタスク追加時以外） */}
          {!parentTask && !(editingTask?.parentId) && (
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">サブタスク（任意）</label>
              <div className="space-y-2.5">
                {subtasks.map((st, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="w-3 border-l border-b border-gray-200 dark:border-gray-600 h-3 flex-shrink-0 mt-2.5" />
                    <div className="flex-1 space-y-1.5">
                      <input
                        type="text"
                        value={st.title}
                        onChange={(e) => {
                          const updated = [...subtasks];
                          updated[i] = { ...updated[i], title: e.target.value };
                          setSubtasks(updated);
                        }}
                        placeholder={`サブタスク ${i + 1}`}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
                      />
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={st.startDate}
                          onChange={(e) => {
                            const updated = [...subtasks];
                            updated[i] = { ...updated[i], startDate: e.target.value };
                            setSubtasks(updated);
                          }}
                          className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-xs bg-white dark:bg-gray-700 dark:text-gray-100 text-gray-400 dark:text-gray-500"
                        />
                        <span className="text-gray-400 dark:text-gray-500 text-xs flex-shrink-0">〜</span>
                        <input
                          type="date"
                          value={st.dueDate}
                          onChange={(e) => {
                            const updated = [...subtasks];
                            updated[i] = { ...updated[i], dueDate: e.target.value };
                            setSubtasks(updated);
                          }}
                          className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-xs bg-white dark:bg-gray-700 dark:text-gray-100 text-gray-400 dark:text-gray-500"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSubtasks(subtasks.filter((_, j) => j !== i))}
                      className="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 transition-colors p-1 mt-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSubtasks([...subtasks, { title: '', startDate: '', dueDate: '' }])}
                  className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-[var(--accent)] dark:hover:text-[var(--accent)] transition-colors py-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  サブタスクを追加
                </button>
              </div>
            </div>
          )}

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
