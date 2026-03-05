'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/db';
import DatePicker from '@/components/DatePicker';
import type { Task, Category, ReminderType } from '@/types';

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
  const [block, setBlock] = useState('');
  const [calendarDisplay, setCalendarDisplay] = useState<'bar' | 'background'>('bar');
  const [subtasks, setSubtasks] = useState<{ id?: number; title: string; startDate: string; dueDate: string }[]>([]);
  const [isFolder, setIsFolder] = useState(false);
  const [reminder, setReminder] = useState<ReminderType>(null);
  const [parentDateConstraints, setParentDateConstraints] = useState<{ min?: string; max?: string }>({});

  // 折りたたみ状態
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showMemo, setShowMemo] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    if (editingTask?.parentId) {
      db.tasks.get(editingTask.parentId).then(parent => {
        if (parent) {
          setParentDateConstraints({ min: parent.startDate, max: parent.dueDate });
        }
      });
    } else if (parentTask) {
      setParentDateConstraints({ min: parentTask.startDate, max: parentTask.dueDate });
    } else {
      setParentDateConstraints({});
    }
  }, [editingTask, parentTask, isOpen]);

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setMemo(editingTask.memo || '');
      setCategoryId(editingTask.categoryId);
      setPriority(editingTask.priority);
      setStartDate(editingTask.startDate || '');
      setDueDate(editingTask.dueDate || '');
      setBlock(editingTask.block || '');
      setCalendarDisplay(editingTask.calendarDisplay || 'bar');
      setIsFolder(editingTask.isFolder || false);
      setReminder(editingTask.reminder || null);
      setShowMemo(!!editingTask.memo);
      setShowDatePicker(false);
      setShowCategoryPicker(false);
      setShowReminder(false);
      // 親タスク編集時は既存サブタスクを読み込む
      if (editingTask.id !== undefined && !editingTask.parentId) {
        db.tasks.where('parentId').equals(editingTask.id).toArray().then(existing => {
          setSubtasks(existing.map(s => ({ id: s.id, title: s.title, startDate: s.startDate || '', dueDate: s.dueDate || '' })));
          setShowSubtasks(false);
        });
      } else {
        setSubtasks([]);
        setShowSubtasks(false);
      }
    } else if (parentTask) {
      setTitle('');
      setMemo('');
      setCategoryId(parentTask.categoryId);
      setPriority(parentTask.priority);
      setStartDate('');
      setDueDate(parentTask.dueDate || '');
      setBlock(parentTask.block || '');
      setCalendarDisplay('bar');
      setIsFolder(false);
      setReminder(null);
      setSubtasks([]);
      setShowMemo(false);
      setShowDatePicker(false);
      setShowCategoryPicker(false);
      setShowSubtasks(false);
      setShowReminder(false);
    } else {
      setTitle('');
      setMemo('');
      setCategoryId(categories[0]?.id || 0);
      setPriority('medium');
      setStartDate('');
      setDueDate('');
      setBlock('');
      setCalendarDisplay('bar');
      setIsFolder(false);
      setReminder(null);
      setSubtasks([]);
      setShowMemo(false);
      setShowDatePicker(false);
      setShowCategoryPicker(false);
      setShowSubtasks(false);
      setShowReminder(false);
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

  const isSubtask = !!parentTask || !!editingTask?.parentId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const validSubtasks = subtasks
      .filter(s => s.title.trim())
      .map(s => ({ id: s.id, title: s.title.trim(), startDate: s.startDate || undefined, dueDate: s.dueDate || undefined }));
    onSave(
      { title: title.trim(), memo: memo.trim() || undefined, categoryId, priority, startDate: startDate || undefined, dueDate: dueDate || undefined, block: (block || undefined) as Task['block'], parentId: parentTask?.id, isFolder: isFolder || undefined, calendarDisplay: calendarDisplay !== 'bar' ? calendarDisplay : undefined, reminder: reminder || undefined },
      !parentTask && !(editingTask?.parentId) ? validSubtasks : undefined
    );
    onClose();
  };

  // 選択中のカテゴリ情報を取得
  const selectedCategory = categories.find(c => c.id === categoryId);
  const selectedParentCategory = selectedCategory?.parentId
    ? categories.find(c => c.id === selectedCategory.parentId)
    : selectedCategory;

  // 期間の表示テキスト
  const formatDateShort = (d: string) => {
    const [, m, day] = d.split('-');
    return `${Number(m)}/${Number(day)}`;
  };
  const dateLabel = startDate && dueDate
    ? `${formatDateShort(startDate)} 〜 ${formatDateShort(dueDate)}`
    : startDate
    ? `${formatDateShort(startDate)} 〜`
    : dueDate
    ? `〜 ${formatDateShort(dueDate)}`
    : '';

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center animate-overlay" role="dialog" aria-modal="true" aria-labelledby="task-modal-title" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 max-h-[85vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="task-modal-title" className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          {editingTask ? 'タスクを編集' : parentTask ? 'サブタスクを追加' : 'タスクを追加'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* タスク名 - 常に表示 */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="タスク名"
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
            autoFocus
          />

          {/* 優先度 - 常に表示（コンパクト） */}
          {!isSubtask && (
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
          )}

          {/* カテゴリ・期間・メモ - 横並びチップ */}
          {!isSubtask && (
            <div className="space-y-2">
              <div className="flex gap-2 flex-wrap">
                {/* カテゴリボタン */}
                {!parentTask && !editingTask?.parentId && (
                  <button
                    type="button"
                    onClick={() => { setShowCategoryPicker(!showCategoryPicker); setShowDatePicker(false); setShowMemo(false); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedParentCategory?.color || '#6b7280' }} />
                    {selectedCategory?.parentId && selectedParentCategory
                      ? `${selectedParentCategory.name} / ${selectedCategory.name}`
                      : selectedCategory?.name || '未選択'}
                  </button>
                )}
                {/* 期間ボタン */}
                <button
                  type="button"
                  onClick={() => { setShowDatePicker(!showDatePicker); setShowCategoryPicker(false); setShowMemo(false); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    dateLabel
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  {dateLabel || '期間'}
                </button>
                {/* メモボタン */}
                <button
                  type="button"
                  onClick={() => { setShowMemo(!showMemo); setShowCategoryPicker(false); setShowDatePicker(false); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    memo
                      ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                  {memo ? 'メモあり' : 'メモ'}
                </button>
                {/* リマインドボタン */}
                <button
                  type="button"
                  onClick={() => { setShowReminder(!showReminder); setShowCategoryPicker(false); setShowDatePicker(false); setShowMemo(false); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    reminder
                      ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                  {reminder === 'morning' ? '当日朝' : reminder === 'day-before' ? '前日' : '通知'}
                </button>
                {/* フォルダボタン */}
                {!parentTask && !editingTask?.parentId && (
                  <button
                    type="button"
                    onClick={() => setIsFolder(!isFolder)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isFolder
                        ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    {isFolder ? 'フォルダ' : 'フォルダ'}
                  </button>
                )}
              </div>

              {/* カテゴリ展開 - 縦スクロールリスト */}
              {showCategoryPicker && (
                <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                  <div className="max-h-40 overflow-y-auto">
                    {categories.filter(c => !c.parentId).map((parent) => {
                      const subs = categories.filter(c => c.parentId === parent.id);
                      const isParentSelected = categoryId === parent.id;
                      const hasSelectedSub = subs.some(s => s.id === categoryId);
                      return (
                        <div key={parent.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setCategoryId(parent.id!);
                              if (!subs.length) setShowCategoryPicker(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-all ${
                              isParentSelected
                                ? 'bg-gray-50 dark:bg-gray-700'
                                : hasSelectedSub
                                ? 'bg-gray-50/50 dark:bg-gray-700/50'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: parent.color }} />
                            <span className={`${(isParentSelected || hasSelectedSub) ? 'text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
                              {parent.name}
                            </span>
                            {isParentSelected && !hasSelectedSub && (
                              <svg className="w-3.5 h-3.5 ml-auto text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            )}
                          </button>
                          {subs.length > 0 && (isParentSelected || hasSelectedSub) && subs.map(sub => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => {
                                setCategoryId(sub.id!);
                                setShowCategoryPicker(false);
                              }}
                              className={`w-full flex items-center gap-2.5 pl-8 pr-3 py-2 text-[11px] font-medium transition-all ${
                                categoryId === sub.id
                                  ? 'bg-gray-50 dark:bg-gray-700'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                              }`}
                            >
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: parent.color, opacity: 0.7 }} />
                              <span className={`${categoryId === sub.id ? 'text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                {sub.name}
                              </span>
                              {categoryId === sub.id && (
                                <svg className="w-3.5 h-3.5 ml-auto text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 期間展開 */}
              {showDatePicker && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <DatePicker
                        value={startDate}
                        onChange={(v) => {
                          setStartDate(v);
                          if (v && dueDate && dueDate < v) setDueDate('');
                        }}
                        placeholder="開始日"
                        min={parentDateConstraints.min}
                        max={dueDate || parentDateConstraints.max}
                      />
                    </div>
                    <span className="text-gray-400 dark:text-gray-500 text-sm flex-shrink-0">〜</span>
                    <div className="flex-1">
                      <DatePicker
                        value={dueDate}
                        onChange={setDueDate}
                        placeholder="期限"
                        min={startDate || parentDateConstraints.min}
                        max={parentDateConstraints.max}
                      />
                    </div>
                  </div>
                  {(startDate || dueDate) && (
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">カレンダー表示</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCalendarDisplay('bar')}
                          className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                            calendarDisplay === 'bar'
                              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          バー
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalendarDisplay('background')}
                          className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                            calendarDisplay === 'background'
                              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          背景色
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* メモ展開 */}
              {showMemo && (
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="メモを入力..."
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm resize-none bg-white dark:bg-gray-700 dark:text-gray-100"
                  rows={2}
                  autoFocus
                />
              )}

              {/* リマインド展開 */}
              {showReminder && (
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">リマインド通知（期限が必要）</label>
                  <div className="flex gap-2">
                    {([
                      { value: null, label: 'なし' },
                      { value: 'morning', label: '当日朝' },
                      { value: 'day-before', label: '前日' },
                    ] as const).map((r) => (
                      <button
                        key={r.label}
                        type="button"
                        onClick={() => setReminder(r.value)}
                        className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                          reminder === r.value
                            ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                            : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  {reminder && !dueDate && (
                    <p className="text-xs text-red-400 mt-1.5">期限を設定してください</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* サブタスク編集時の期限 */}
          {isSubtask && (
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">期限（任意）</label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <DatePicker
                    value={startDate}
                    onChange={(v) => {
                      setStartDate(v);
                      if (v && dueDate && dueDate < v) setDueDate('');
                    }}
                    placeholder="開始日"
                    min={parentDateConstraints.min}
                    max={dueDate || parentDateConstraints.max}
                  />
                </div>
                <span className="text-gray-400 dark:text-gray-500 text-sm flex-shrink-0">〜</span>
                <div className="flex-1">
                  <DatePicker
                    value={dueDate}
                    onChange={setDueDate}
                    placeholder="期限"
                    min={startDate || parentDateConstraints.min}
                    max={parentDateConstraints.max}
                  />
                </div>
              </div>
            </div>
          )}

          {/* サブタスク - 折りたたみ */}
          {!parentTask && !(editingTask?.parentId) && (
            <div>
              <button
                type="button"
                onClick={() => setShowSubtasks(!showSubtasks)}
                className="flex items-center gap-2 w-full py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${showSubtasks ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium">サブタスク</span>
                {subtasks.filter(s => s.title.trim()).length > 0 && (
                  <span className="text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                    {subtasks.filter(s => s.title.trim()).length}件
                  </span>
                )}
              </button>
              {showSubtasks && (
                <div className="space-y-2.5 pl-5.5 pt-1">
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
                          <div className="flex-1">
                            <DatePicker
                              value={st.startDate}
                              onChange={(v) => {
                                const updated = [...subtasks];
                                updated[i] = { ...updated[i], startDate: v };
                                if (v && updated[i].dueDate && updated[i].dueDate < v) {
                                  updated[i] = { ...updated[i], startDate: v, dueDate: '' };
                                }
                                setSubtasks(updated);
                              }}
                              placeholder="開始"
                              min={startDate || undefined}
                              max={st.dueDate || dueDate || undefined}
                              size="small"
                            />
                          </div>
                          <span className="text-gray-400 dark:text-gray-500 text-xs flex-shrink-0">〜</span>
                          <div className="flex-1">
                            <DatePicker
                              value={st.dueDate}
                              onChange={(v) => {
                                const updated = [...subtasks];
                                updated[i] = { ...updated[i], dueDate: v };
                                setSubtasks(updated);
                              }}
                              placeholder="期限"
                              min={st.startDate || startDate || undefined}
                              max={dueDate || undefined}
                              size="small"
                            />
                          </div>
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
              )}
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
