'use client';

import { useState, useEffect } from 'react';
import type { CheckList, ListType, Category } from '@/types';

interface AddListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; type: ListType; color: string; categoryId: number }) => void;
  editingList?: CheckList | null;
  categories: Category[];
}

const COLORS = [
  '#3b82f6', '#ef4444', '#f59e0b', '#10b981',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

export default function AddListModal({ isOpen, onClose, onSave, editingList, categories }: AddListModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ListType>('packing');
  const [color, setColor] = useState(COLORS[0]);
  const [categoryId, setCategoryId] = useState<number>(0);

  useEffect(() => {
    if (editingList) {
      setName(editingList.name);
      setType(editingList.type);
      setColor(editingList.color);
      setCategoryId(editingList.categoryId || 0);
    } else {
      setName('');
      setType('packing');
      setColor(COLORS[0]);
      setCategoryId(categories[0]?.id || 0);
    }
  }, [editingList, isOpen, categories]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), type, color, categoryId });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center animate-overlay" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 w-full max-w-lg mx-4 rounded-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="text-sm text-gray-400">キャンセル</button>
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">
            {editingList ? 'リストを編集' : 'リストを作成'}
          </h2>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="text-sm font-semibold text-[var(--accent)] disabled:opacity-30"
          >
            {editingList ? '保存' : '作成'}
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* リスト名 */}
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="リスト名"
              className="w-full text-base bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              autoFocus
            />
          </div>

          {/* カテゴリ選択 */}
          {categories.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">カテゴリ</p>
              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryId(cat.id!)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all duration-200 ${
                      categoryId === cat.id
                        ? 'ring-2 ring-offset-1 dark:ring-offset-gray-900'
                        : 'opacity-50 hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: `${cat.color}20`,
                      color: cat.color,
                      ...(categoryId === cat.id ? { '--tw-ring-color': cat.color } as React.CSSProperties : {}),
                    }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* タイプ選択 */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">タイプ</p>
            <div className="flex gap-2">
              <button
                onClick={() => setType('packing')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  type === 'packing'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                持ち物チェック
              </button>
              <button
                onClick={() => setType('shopping')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  type === 'shopping'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                買い物リスト
              </button>
            </div>
          </div>

          {/* 色選択 */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">カラー</p>
            <div className="flex gap-3">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900' : ''
                  }`}
                  style={{ backgroundColor: c, '--tw-ring-color': c } as React.CSSProperties}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
