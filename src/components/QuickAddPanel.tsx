'use client';

import { useState, useEffect, useRef } from 'react';
import type { Category } from '@/types';

interface QuickAddPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: { title: string; categoryId: number; startDate?: string; dueDate?: string }) => void;
  onOpenRoutineModal: () => void;
  categories: Category[];
}

export default function QuickAddPanel({ isOpen, onClose, onAdd, onOpenRoutineModal, categories }: QuickAddPanelProps) {
  const [title, setTitle] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<'none' | 'today' | 'tomorrow' | 'custom'>('none');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // カテゴリ初期値
  useEffect(() => {
    if (isOpen && categories.length > 0 && selectedCategoryId === 0) {
      setSelectedCategoryId(categories[0]?.id || 0);
    }
  }, [isOpen, categories, selectedCategoryId]);

  // パネルが開いたらフォーカス
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const getStartDate = () => {
    if (selectedDate === 'custom') return startDate || undefined;
    return undefined;
  };

  const getDueDate = () => {
    switch (selectedDate) {
      case 'today': return today;
      case 'tomorrow': return tomorrow;
      case 'custom': return dueDate || undefined;
      default: return undefined;
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      categoryId: selectedCategoryId,
      startDate: getStartDate(),
      dueDate: getDueDate(),
    });
    setTitle('');
    // パネルは開いたまま（連続追加用）
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClose = () => {
    setTitle('');
    setSelectedDate('none');
    setStartDate('');
    setDueDate('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 animate-overlay" onClick={handleClose}>
      {/* パネル */}
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-lg mx-4 rounded-2xl px-5 pt-5 pb-6 animate-slide-up max-h-[85vh] overflow-y-auto"
        style={{ boxShadow: '0 4px 30px rgba(0,0,0,0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* テキスト入力 */}
        <div className="relative mb-4">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="タスクを追加..."
            className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 text-[15px] bg-gray-50 dark:bg-gray-700 dark:text-gray-100 pr-12"
          />
          {/* 送信ボタン（テキストがある時だけ表示） */}
          {title.trim() && (
            <button
              onClick={handleSubmit}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[var(--accent)] text-white rounded-lg flex items-center justify-center active:scale-90 transition-all"
              aria-label="追加"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </button>
          )}
        </div>

        {/* カテゴリ選択（親カテゴリのみ） */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {categories.filter(c => !c.parentId).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id!)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all duration-200 ${
                selectedCategoryId === cat.id
                  ? 'ring-2 ring-offset-1 dark:ring-offset-gray-800'
                  : 'opacity-50 hover:opacity-80'
              }`}
              style={{
                backgroundColor: `${cat.color}20`,
                color: cat.color,
                ...(selectedCategoryId === cat.id ? { '--tw-ring-color': cat.color } as React.CSSProperties : {}),
              }}
              aria-label={`カテゴリ: ${cat.name}`}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              {cat.name}
            </button>
          ))}
        </div>

        {/* クイック日付ボタン */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSelectedDate(selectedDate === 'custom' ? 'none' : 'custom')}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 border ${
              selectedDate === 'custom'
                ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            期限
          </button>
          <button
            onClick={() => setSelectedDate(selectedDate === 'today' ? 'none' : 'today')}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 border ${
              selectedDate === 'today'
                ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            今日
          </button>
          <button
            onClick={() => setSelectedDate(selectedDate === 'tomorrow' ? 'none' : 'tomorrow')}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 border ${
              selectedDate === 'tomorrow'
                ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            明日
          </button>
        </div>

        {/* 日付ピッカー（開始日・期限） */}
        {selectedDate === 'custom' && (
          <div className="mb-4 flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-gray-400 dark:text-gray-500 mb-1 block">開始日</label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300 pr-8"
                />
                {startDate && (
                  <button
                    type="button"
                    onClick={() => setStartDate('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 active:scale-90 transition-all"
                    aria-label="開始日をクリア"
                  >
                    <svg className="w-3 h-3 text-gray-500 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <span className="text-gray-300 dark:text-gray-600 mt-4">〜</span>
            <div className="flex-1">
              <label className="text-[10px] text-gray-400 dark:text-gray-500 mb-1 block">期限</label>
              <div className="relative">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={startDate || undefined}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300 pr-8"
                />
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => setDueDate('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 active:scale-90 transition-all"
                    aria-label="期限をクリア"
                  >
                    <svg className="w-3 h-3 text-gray-500 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 下部ボタン */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* ルーティン追加リンク */}
            <button
              onClick={() => {
                handleClose();
                onOpenRoutineModal();
              }}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-purple-500 dark:hover:text-purple-400 transition-colors flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992" />
              </svg>
              ルーティン
            </button>
          </div>

          <button
            onClick={handleClose}
            className="px-5 py-2 text-sm text-blue-500 dark:text-blue-400 font-semibold rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-95 transition-all"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
