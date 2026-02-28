'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { updateSettings } from '@/lib/settings';
import type { Settings, Category } from '@/types';

interface SettingsViewProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings | undefined;
}

const PRESET_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899',
  '#06B6D4', '#EF4444', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#78716C', '#0EA5E9', '#E11D48',
];

export default function SettingsView({ isOpen, onClose, settings }: SettingsViewProps) {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6');
  const [showAddCategory, setShowAddCategory] = useState(false);

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());

  if (!isOpen || !settings) return null;

  const handleThemeChange = async (theme: 'light' | 'dark') => {
    await updateSettings({ theme });
    document.documentElement.classList.toggle('dark', theme === 'dark');
  };

  const handleSoundToggle = async () => {
    await updateSettings({ soundEnabled: !settings.soundEnabled });
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const maxOrder = categories ? Math.max(...categories.map(c => c.order), -1) : 0;
    await db.categories.add({
      name: newCategoryName.trim(),
      color: newCategoryColor,
      order: maxOrder + 1,
      type: 'task',
    });
    setNewCategoryName('');
    setNewCategoryColor('#3B82F6');
    setShowAddCategory(false);
  };

  const handleUpdateCategory = async (id: number, updates: Partial<Category>) => {
    await db.categories.update(id, updates);
    setEditingCategory(null);
  };

  const handleDeleteCategory = async (id: number) => {
    const tasksInCategory = await db.tasks.where('categoryId').equals(id).count();
    if (tasksInCategory > 0) {
      alert(`このカテゴリには${tasksInCategory}個のタスクがあります。先にタスクを移動してください。`);
      return;
    }
    await db.categories.delete(id);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose}>
      <div
        className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-gray-900 shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">設定</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            >
              ✕
            </button>
          </div>

          {/* テーマ */}
          <section className="mb-8">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">テーマ</h3>
            <div className="flex gap-3">
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                  settings.theme === 'light'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                ☀️ ライト
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                  settings.theme === 'dark'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                🌙 ダーク
              </button>
            </div>
          </section>

          {/* 効果音 */}
          <section className="mb-8">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">効果音</h3>
            <button
              onClick={handleSoundToggle}
              className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${
                settings.soundEnabled
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}
            >
              {settings.soundEnabled ? '🔊 ON' : '🔇 OFF'}
            </button>
          </section>

          {/* カテゴリ管理 */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">カテゴリ</h3>
              <button
                onClick={() => setShowAddCategory(true)}
                className="text-xs text-blue-500 hover:text-blue-700 font-medium"
              >
                + 追加
              </button>
            </div>

            {showAddCategory && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-3">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="カテゴリ名"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm mb-3 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  autoFocus
                />
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewCategoryColor(color)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        newCategoryColor === color ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddCategory(false)}
                    className="flex-1 py-2 text-xs text-gray-500 bg-gray-200 dark:bg-gray-600 rounded-lg"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleAddCategory}
                    className="flex-1 py-2 text-xs text-white bg-blue-500 rounded-lg"
                  >
                    追加
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {categories?.map((cat) => (
                <div key={cat.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  {editingCategory && editingCategory.id === cat.id ? (
                    <div>
                      <input
                        type="text"
                        value={editingCategory.name}
                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm mb-2 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <div className="flex flex-wrap gap-2 mb-2">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setEditingCategory({ ...editingCategory, color })}
                            className={`w-6 h-6 rounded-full transition-transform ${
                              editingCategory.color === color ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingCategory(null)}
                          className="flex-1 py-1.5 text-xs text-gray-500 bg-gray-200 dark:bg-gray-600 rounded-lg"
                        >
                          キャンセル
                        </button>
                        <button
                          onClick={() => handleUpdateCategory(cat.id!, { name: editingCategory.name, color: editingCategory.color })}
                          className="flex-1 py-1.5 text-xs text-white bg-blue-500 rounded-lg"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{cat.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingCategory(cat)}
                          className="text-xs text-gray-400 hover:text-blue-500 px-2 py-1"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id!)}
                          className="text-xs text-gray-400 hover:text-red-500 px-2 py-1"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
