'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { updateSettings } from '@/lib/settings';
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed, getNotificationPermission } from '@/lib/push';
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
  const [addingSubTo, setAddingSubTo] = useState<number | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      isPushSubscribed().then(setPushEnabled);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const handlePushToggle = async () => {
    setPushLoading(true);
    try {
      if (pushEnabled) {
        const ok = await unsubscribeFromPush();
        if (ok) setPushEnabled(false);
      } else {
        const permission = getNotificationPermission();
        if (permission === 'unsupported') {
          alert('このブラウザは通知に対応していません');
          return;
        }
        if (permission === 'denied') {
          alert('通知がブロックされています。ブラウザの設定から許可してください');
          return;
        }
        const ok = await subscribeToPush();
        if (ok) setPushEnabled(true);
      }
    } finally {
      setPushLoading(false);
    }
  };

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
    // サブカテゴリも確認
    const subs = categories?.filter(c => c.parentId === id) || [];
    for (const sub of subs) {
      const subTasks = await db.tasks.where('categoryId').equals(sub.id!).count();
      if (subTasks > 0) {
        alert(`サブカテゴリ「${sub.name}」にタスクがあります。先にタスクを移動してください。`);
        return;
      }
    }
    // サブカテゴリも一緒に削除
    const subIds = subs.map(s => s.id!).filter(Boolean);
    if (subIds.length > 0) await db.categories.bulkDelete(subIds);
    await db.categories.delete(id);
  };

  const handleAddSubCategory = async (parentId: number) => {
    if (!newSubName.trim()) return;
    const parent = categories?.find(c => c.id === parentId);
    if (!parent) return;
    const subs = categories?.filter(c => c.parentId === parentId) || [];
    const maxOrder = subs.length > 0 ? Math.max(...subs.map(s => s.order)) : -1;
    await db.categories.add({
      name: newSubName.trim(),
      color: parent.color,
      order: maxOrder + 1,
      type: parent.type,
      parentId,
    });
    setNewSubName('');
    setAddingSubTo(null);
  };

  const handleDeleteSubCategory = async (id: number) => {
    const tasksInCategory = await db.tasks.where('categoryId').equals(id).count();
    if (tasksInCategory > 0) {
      alert(`このサブカテゴリにはタスクがあります。先にタスクを移動してください。`);
      return;
    }
    await db.categories.delete(id);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 animate-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={onClose}>
      <div
        className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-gray-900 shadow-xl overflow-y-auto animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 id="settings-title" className="text-lg font-bold text-gray-800 dark:text-gray-100">設定</h2>
            <button
              onClick={onClose}
              aria-label="設定を閉じる"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 active:scale-90 transition-transform"
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

          {/* プッシュ通知 */}
          <section className="mb-8">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">プッシュ通知</h3>
            <button
              onClick={handlePushToggle}
              disabled={pushLoading}
              className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${
                pushEnabled
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              } ${pushLoading ? 'opacity-50' : ''}`}
            >
              {pushLoading ? '処理中...' : pushEnabled ? '🔔 ON' : '🔕 OFF'}
            </button>
            {pushEnabled && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                タスクの期限前にリマインド通知が届きます
              </p>
            )}
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
              {categories?.filter(c => !c.parentId).map((cat) => {
                const subs = categories?.filter(c => c.parentId === cat.id) || [];
                return (
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
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{cat.name}</span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => { setAddingSubTo(addingSubTo === cat.id ? null : cat.id!); setNewSubName(''); }}
                              className="text-xs text-gray-400 hover:text-green-500 px-2 py-1"
                            >
                              +小分類
                            </button>
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

                        {/* サブカテゴリ一覧 */}
                        {subs.length > 0 && (
                          <div className="mt-2 ml-7 space-y-1">
                            {subs.map(sub => (
                              <div key={sub.id} className="flex items-center justify-between py-1">
                                {editingCategory && editingCategory.id === sub.id ? (
                                  <div className="flex-1">
                                    <input
                                      type="text"
                                      value={editingCategory.name}
                                      onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                                      className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded text-xs mb-1 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                    <div className="flex gap-1">
                                      <button onClick={() => setEditingCategory(null)} className="flex-1 py-1 text-[10px] text-gray-500 bg-gray-200 dark:bg-gray-600 rounded">キャンセル</button>
                                      <button onClick={() => handleUpdateCategory(sub.id!, { name: editingCategory.name })} className="flex-1 py-1 text-[10px] text-white bg-blue-500 rounded">保存</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">└ {sub.name}</span>
                                    <div className="flex gap-1">
                                      <button onClick={() => setEditingCategory(sub)} className="text-[10px] text-gray-300 hover:text-blue-500 px-1">編集</button>
                                      <button onClick={() => handleDeleteSubCategory(sub.id!)} className="text-[10px] text-gray-300 hover:text-red-500 px-1">削除</button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* サブカテゴリ追加フォーム */}
                        {addingSubTo === cat.id && (
                          <div className="mt-2 ml-7 flex gap-2">
                            <input
                              type="text"
                              value={newSubName}
                              onChange={(e) => setNewSubName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubCategory(cat.id!); }}
                              placeholder="小分類の名前"
                              className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
                              autoFocus
                            />
                            <button
                              onClick={() => handleAddSubCategory(cat.id!)}
                              className="px-3 py-1.5 text-xs text-white bg-blue-500 rounded hover:bg-blue-600"
                            >
                              追加
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
