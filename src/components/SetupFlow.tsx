'use client';

import { useState } from 'react';
import { db } from '@/lib/db';
import { updateSettings } from '@/lib/settings';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Category } from '@/types';

interface SetupFlowProps {
  onComplete: () => void;
}

type Step = 0 | 1 | 2 | 3 | 4;

export default function SetupFlow({ onComplete }: SetupFlowProps) {
  const [step, setStep] = useState<Step>(0);
  const [wakeUpTime, setWakeUpTime] = useState('07:00');
  const [bedTime, setBedTime] = useState('23:00');
  const [dreams, setDreams] = useState('');
  const [idealSelf, setIdealSelf] = useState('');

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());

  const [editingCategories, setEditingCategories] = useState<Category[] | null>(null);
  const displayCategories = editingCategories ?? categories ?? [];

  // カテゴリ編集が始まったらコピーを作る
  const ensureEditingCopy = () => {
    if (!editingCategories && categories) {
      setEditingCategories([...categories]);
    }
  };

  const handleCategoryToggle = (index: number) => {
    ensureEditingCopy();
    setEditingCategories(prev => {
      if (!prev) return prev;
      const updated = [...prev];
      // _removedフラグで非表示にする（DBからは消さない）
      (updated[index] as Category & { _removed?: boolean })._removed =
        !(updated[index] as Category & { _removed?: boolean })._removed;
      return updated;
    });
  };

  const handleComplete = async () => {
    // プロフィール保存
    await db.userProfile.clear();
    await db.userProfile.add({
      wakeUpTime,
      bedTime,
      dreams: dreams || undefined,
      idealSelf: idealSelf || undefined,
      createdAt: new Date().toISOString(),
    });

    // 除外されたカテゴリを削除
    if (editingCategories) {
      for (const cat of editingCategories) {
        if ((cat as Category & { _removed?: boolean })._removed && cat.id) {
          await db.categories.delete(cat.id);
        }
      }
    }

    // セットアップ完了フラグ
    await updateSettings({ setupCompleted: true });
    onComplete();
  };

  const next = () => setStep(s => Math.min(s + 1, 4) as Step);
  const prev = () => setStep(s => Math.max(s - 1, 0) as Step);

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* プログレスドット */}
        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step
                  ? 'w-6 bg-blue-500'
                  : i < step
                  ? 'bg-blue-300'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Step 0: ようこそ */}
        {step === 0 && (
          <div className="animate-fade-in text-center">
            <div className="text-5xl mb-6">✨</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              ようこそ！
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-2 leading-relaxed">
              AIライフプランナーは、あなたの毎日を
              <br />
              まるごとサポートするアプリです。
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-10">
              やること・ルーティン・目標を管理して
              <br />
              毎日「全部できた！」を体験しよう
            </p>
            <button
              onClick={next}
              className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 active:scale-[0.98] transition-all"
            >
              はじめる
            </button>
          </div>
        )}

        {/* Step 1: 基本情報 */}
        {step === 1 && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <div className="text-4xl mb-4">⏰</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                生活リズムを教えてね
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                あとから設定で変えられるよ
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  起きる時間
                </label>
                <input
                  type="time"
                  value={wakeUpTime}
                  onChange={e => setWakeUpTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  寝る時間
                </label>
                <input
                  type="time"
                  value={bedTime}
                  onChange={e => setBedTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-10">
              <button
                onClick={prev}
                className="flex-1 py-3 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                もどる
              </button>
              <button
                onClick={next}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 active:scale-[0.98] transition-all"
              >
                つぎへ
              </button>
            </div>
          </div>
        )}

        {/* Step 2: やりたいこと・なりたい自分 */}
        {step === 2 && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <div className="text-4xl mb-4">💭</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                あなたのこと教えてね
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                スキップしてもOK！あとで追加できるよ
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  やりたいこと・夢
                </label>
                <textarea
                  value={dreams}
                  onChange={e => setDreams(e.target.value)}
                  placeholder="例: アプリを作って公開したい、英語を話せるようになりたい"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  なりたい自分
                </label>
                <textarea
                  value={idealSelf}
                  onChange={e => setIdealSelf(e.target.value)}
                  placeholder="例: 自分に自信が持てる人、毎日充実してる人"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-10">
              <button
                onClick={prev}
                className="flex-1 py-3 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                もどる
              </button>
              <button
                onClick={next}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 active:scale-[0.98] transition-all"
              >
                つぎへ
              </button>
            </div>
          </div>
        )}

        {/* Step 3: カテゴリ確認 */}
        {step === 3 && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <div className="text-4xl mb-4">🏷️</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                カテゴリを確認しよう
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                使わないものはオフにできるよ
                <br />
                あとから設定で変更もOK
              </p>
            </div>

            <div className="space-y-3">
              {displayCategories.map((cat, index) => {
                const isRemoved = (cat as Category & { _removed?: boolean })._removed;
                return (
                  <button
                    key={cat.id ?? index}
                    onClick={() => handleCategoryToggle(index)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      isRemoved
                        ? 'border-gray-200 dark:border-gray-700 opacity-40'
                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className={`flex-1 text-left text-gray-900 dark:text-white ${isRemoved ? 'line-through' : ''}`}>
                      {cat.name}
                    </span>
                    <div className={`w-10 h-6 rounded-full transition-colors flex items-center ${
                      isRemoved ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-500'
                    }`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${
                        isRemoved ? 'translate-x-0' : 'translate-x-4'
                      }`} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 mt-10">
              <button
                onClick={prev}
                className="flex-1 py-3 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                もどる
              </button>
              <button
                onClick={next}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 active:scale-[0.98] transition-all"
              >
                つぎへ
              </button>
            </div>
          </div>
        )}

        {/* Step 4: 完了 */}
        {step === 4 && (
          <div className="animate-fade-in text-center">
            <div className="text-5xl mb-6">🎉</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              準備できた！
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-2 leading-relaxed">
              さっそく今日のやることを
              <br />
              追加してみよう
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-10">
              設定はいつでも変更できるよ
            </p>
            <button
              onClick={handleComplete}
              className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 active:scale-[0.98] transition-all"
            >
              はじめよう！
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
