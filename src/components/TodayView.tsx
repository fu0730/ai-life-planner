'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import TaskItem from './TaskItem';
import ProgressBar from './ProgressBar';
import { playCompleteSound, playAllCompleteSound, playTimerEndSound } from '@/lib/sounds';
import Confetti from './Confetti';
import type { Task, Routine, RoutineCompletion, Settings, TimeBlock } from '@/types';

interface TodayViewProps {
  onEditTask: (task: Task) => void;
  onEditRoutine: (routine: Routine) => void;
  onAddSubtask: (parentTask: Task) => void;
  settings: Settings | undefined;
}

const BLOCKS: { key: TimeBlock; label: string; emoji: string }[] = [
  { key: 'morning', label: '朝', emoji: '🌅' },
  { key: 'forenoon', label: '午前', emoji: '🌤' },
  { key: 'afternoon', label: '午後', emoji: '🌇' },
  { key: 'night', label: '夜', emoji: '🌙' },
];

interface RoutineItemProps {
  routine: Routine;
  completed: boolean;
  onToggle: () => void;
  onEdit: (routine: Routine) => void;
  onDelete: (id: number) => void;
  soundEnabled: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function RoutineItem({ routine, completed, onToggle, onEdit, onDelete, soundEnabled }: RoutineItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // タイマー完了時に自動クリーンアップ
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const startTimer = () => {
    if (!routine.estimatedMinutes) return;
    const totalSeconds = routine.estimatedMinutes * 60;
    setTimerSeconds(totalSeconds);
    setIsTimerRunning(true);
    setTimerFinished(false);

    clearTimer();
    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = totalSeconds - elapsed;
      if (remaining <= 0) {
        setTimerSeconds(0);
        setIsTimerRunning(false);
        setTimerFinished(true);
        clearTimer();
        if (soundEnabled) {
          playTimerEndSound();
        }
      } else {
        setTimerSeconds(remaining);
      }
    }, 1000);
  };

  const pauseTimer = () => {
    setIsTimerRunning(false);
    clearTimer();
  };

  const resumeTimer = () => {
    if (timerSeconds === null || timerSeconds <= 0) return;
    setIsTimerRunning(true);
    const remaining = timerSeconds;
    const startTime = Date.now();
    clearTimer();
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const left = remaining - elapsed;
      if (left <= 0) {
        setTimerSeconds(0);
        setIsTimerRunning(false);
        setTimerFinished(true);
        clearTimer();
        if (soundEnabled) {
          playTimerEndSound();
        }
      } else {
        setTimerSeconds(left);
      }
    }, 1000);
  };

  const resetTimer = () => {
    clearTimer();
    setTimerSeconds(null);
    setIsTimerRunning(false);
    setTimerFinished(false);
  };

  const handleToggle = () => {
    if (!completed) {
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 600);
      // 完了時にタイマーをリセット
      resetTimer();
    }
    onToggle();
  };

  const timerProgress = routine.estimatedMinutes && timerSeconds !== null
    ? 1 - timerSeconds / (routine.estimatedMinutes * 60)
    : 0;

  return (
    <div
      className={`rounded-2xl px-4 py-3.5 border transition-all duration-300 ${
        justCompleted ? 'animate-completion-flash' : ''
      } ${completed ? 'opacity-50' : ''} ${timerFinished ? 'ring-2 ring-orange-300 dark:ring-orange-600' : ''} bg-white dark:bg-gray-800/60 border-[var(--border)]`}
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex items-center gap-3.5">
        {/* ルーティンドット（紫色） */}
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-purple-400" />

        {/* チェックボタン */}
        <button
          onClick={handleToggle}
          aria-label={completed ? `${routine.title}を未完了にする` : `${routine.title}を完了にする`}
          className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 active:scale-90 ${
            completed
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
          } ${justCompleted ? 'animate-ripple' : ''}`}
        >
          {completed && (
            <svg className="w-3 h-3 text-white animate-check-pop" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* タイトル */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <p className={`text-[15px] leading-snug transition-all duration-300 ${
            completed
              ? 'line-through text-gray-400 dark:text-gray-500'
              : 'text-gray-800 dark:text-gray-100 font-medium'
          }`}>
            {routine.title}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* タイマー表示 */}
          {timerSeconds !== null && (
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
              timerFinished
                ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400'
                : timerSeconds <= 60
                  ? 'text-red-500 bg-red-50 dark:bg-red-900/30'
                  : 'text-[var(--accent)] bg-[var(--accent-light)]'
            }`}>
              {timerFinished ? '完了!' : formatTime(timerSeconds)}
            </span>
          )}
          {/* タイマーボタン or 目安時間 */}
          {routine.estimatedMinutes && !completed && (
            timerSeconds === null ? (
              <button
                onClick={startTimer}
                className="text-xs text-purple-500 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/50 active:scale-95 transition-all"
                aria-label="タイマーを開始"
              >
                {routine.estimatedMinutes}分
              </button>
            ) : (
              <div className="flex items-center gap-1">
                {!timerFinished && (
                  <button
                    onClick={isTimerRunning ? pauseTimer : resumeTimer}
                    className="w-6 h-6 flex items-center justify-center rounded-full active:scale-95 transition-all bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                    aria-label={isTimerRunning ? 'タイマーを一時停止' : 'タイマーを再開'}
                  >
                    {isTimerRunning ? (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                    ) : (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                  </button>
                )}
                <button
                  onClick={resetTimer}
                  className="w-6 h-6 flex items-center justify-center rounded-full active:scale-95 transition-all bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  aria-label="タイマーをリセット"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            )
          )}
          {routine.estimatedMinutes && completed && (
            <span className="text-xs text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
              {routine.estimatedMinutes}分
            </span>
          )}
        </div>
      </div>

      {/* タイマープログレスバー */}
      {timerSeconds !== null && !timerFinished && routine.estimatedMinutes && (
        <div className="mt-2.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-linear"
            style={{
              width: `${timerProgress * 100}%`,
              backgroundColor: timerSeconds <= 60 ? '#EF4444' : '#8B5CF6',
            }}
          />
        </div>
      )}

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-100/80 dark:border-gray-700/50">
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => onEdit(routine)}
              className="text-xs text-[var(--accent)] px-3 py-1.5 rounded-lg hover:bg-[var(--accent-light)] active:scale-95 transition-all"
            >
              編集
            </button>
            <button
              onClick={() => routine.id !== undefined && onDelete(routine.id)}
              className="text-xs text-gray-400 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all"
            >
              削除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TodayView({ onEditTask, onEditRoutine, onAddSubtask, settings }: TodayViewProps) {
  const [allDoneChoice, setAllDoneChoice] = useState<'none' | 'more' | 'rest'>('none');
  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().getDay(); // 0=日, 1=月, ...

  const tasks = useLiveQuery(
    () => db.tasks.filter((t) => {
      // サブタスクは除外（親タスク内で表示される）
      if (t.parentId) return false;
      if (t.completed && t.completedAt) {
        const completedDate = t.completedAt.split('T')[0];
        if (completedDate === today) return true;
      }
      if (t.dueDate === today) return true;
      if (!t.dueDate && !t.completed) return true;
      return false;
    }).toArray(),
    [today]
  );

  const routines = useLiveQuery(
    () => db.routines.orderBy('order').toArray(),
    []
  );

  const completions = useLiveQuery(
    () => db.routineCompletions.where('date').equals(today).toArray(),
    [today]
  );

  const categories = useLiveQuery(() => db.categories.toArray());

  if (!tasks || !categories || !routines || !completions) {
    return <div className="flex items-center justify-center py-12 text-gray-400 text-sm">読み込み中...</div>;
  }

  // 今日の曜日に該当するルーティンのみ
  const todayRoutines = routines.filter((r) => r.days.includes(dayOfWeek));

  const completionSet = new Set(completions.map((c) => c.routineId));

  // 進捗計算
  const totalItems = tasks.length + todayRoutines.length;
  const completedRoutines = todayRoutines.filter((r) => r.id !== undefined && completionSet.has(r.id)).length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const completedItems = completedRoutines + completedTasks;
  const allDone = totalItems > 0 && completedItems === totalItems;

  const toggleRoutine = async (routineId: number) => {
    if (completionSet.has(routineId)) {
      // 完了解除
      const completion = completions.find((c) => c.routineId === routineId);
      if (completion?.id) {
        await db.routineCompletions.delete(completion.id);
      }
    } else {
      // 完了
      await db.routineCompletions.add({
        routineId,
        date: today,
        completedAt: new Date().toISOString(),
      });

      if (settings?.soundEnabled !== false) {
        // 全完了チェック
        const newCompletedRoutines = completedRoutines + 1;
        if (newCompletedRoutines + completedTasks === totalItems) {
          playAllCompleteSound();
        } else {
          playCompleteSound();
        }
      }
    }
  };

  const toggleTask = async (id: number) => {
    const task = await db.tasks.get(id);
    if (!task) return;
    const nowCompleting = !task.completed;
    await db.tasks.update(id, {
      completed: nowCompleting,
      completedAt: nowCompleting ? new Date().toISOString() : undefined,
    });

    if (nowCompleting && settings?.soundEnabled !== false) {
      const updatedTasks = await db.tasks.filter((t) => {
        if (t.id === id) return true;
        const todayStr = new Date().toISOString().split('T')[0];
        if (t.completed && t.completedAt?.split('T')[0] === todayStr) return true;
        if (t.dueDate === todayStr) return true;
        if (!t.dueDate && !t.completed) return true;
        return false;
      }).toArray();
      const newCompletedTasks = updatedTasks.filter((t) => t.id === id ? true : t.completed).length;
      if (newCompletedTasks + completedRoutines === totalItems) {
        playAllCompleteSound();
      } else {
        playCompleteSound();
      }
    }
  };

  const deleteTask = async (id: number) => {
    const subtasks = await db.tasks.where('parentId').equals(id).toArray();
    const subtaskIds = subtasks.map(s => s.id!).filter(Boolean);
    if (subtaskIds.length > 0) {
      await db.tasks.bulkDelete(subtaskIds);
    }
    await db.tasks.delete(id);
  };

  const deleteRoutine = async (id: number) => {
    await db.routines.delete(id);
    // その日の完了記録も削除
    await db.routineCompletions.where({ routineId: id, date: today }).delete();
  };

  const getCategoryForTask = (categoryId: number) => {
    return categories.find((c) => c.id === categoryId);
  };

  const sortTasks = (taskList: Task[]) => {
    const sortBy = settings?.sortBy || 'priority';
    return [...taskList].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (sortBy === 'priority') {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      }
      if (sortBy === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  // ブロックごとにアイテムを分類
  const getBlockRoutines = (block: TimeBlock) =>
    todayRoutines.filter((r) => r.block === block);

  const getBlockTasks = (block: TimeBlock) =>
    sortTasks(tasks.filter((t) => t.block === block));

  const unblockedTasks = sortTasks(tasks.filter((t) => !t.block));

  const hasBlockItems = (block: TimeBlock) =>
    getBlockRoutines(block).length > 0 || getBlockTasks(block).length > 0;

  return (
    <div className="space-y-4">
      <div className="text-center py-2">
        <p className="text-gray-400 dark:text-gray-500 text-sm tracking-wide">
          {new Date().toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </p>
      </div>

      {totalItems > 0 && <ProgressBar completed={completedItems} total={totalItems} />}

      {/* 全完了演出 */}
      {allDone && allDoneChoice === 'none' && (
        <div className="relative bg-white dark:bg-gray-800/60 rounded-2xl p-8 text-center border border-green-100/60 dark:border-green-800/30 animate-bounce-in overflow-hidden"
          style={{ boxShadow: 'var(--card-shadow)' }}
        >
          <Confetti />
          <p className="text-4xl mb-4">🎉</p>
          <p className="text-gray-800 dark:text-gray-100 font-semibold text-lg">全部おわった！</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1 mb-6">今日もおつかれさま</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setAllDoneChoice('more')}
              className="px-5 py-2.5 bg-[var(--accent)] text-white text-sm rounded-xl hover:opacity-90 active:scale-95 transition-all font-medium"
              style={{ boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}
            >
              もうちょっとやる
            </button>
            <button
              onClick={() => setAllDoneChoice('rest')}
              className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all font-medium"
            >
              ゆっくりする
            </button>
          </div>
        </div>
      )}

      {allDone && allDoneChoice === 'rest' && (
        <div className="bg-white dark:bg-gray-800/60 rounded-2xl p-8 text-center border border-[var(--border)] animate-bounce-in"
          style={{ boxShadow: 'var(--card-shadow)' }}
        >
          <p className="text-3xl mb-3">🌙</p>
          <p className="text-gray-800 dark:text-gray-100 font-semibold">おつかれさま</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">しっかり休もう</p>
        </div>
      )}

      {allDone && allDoneChoice === 'more' && (
        <div className="bg-white dark:bg-gray-800/60 rounded-2xl p-8 text-center border border-[var(--border)] animate-bounce-in"
          style={{ boxShadow: 'var(--card-shadow)' }}
        >
          <p className="text-3xl mb-3">💪</p>
          <p className="text-gray-800 dark:text-gray-100 font-semibold">いいね！</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">ボーナスタスクはAI機能実装後に提案できるよ</p>
        </div>
      )}

      {totalItems === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-7 h-7 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">今日のタスクはまだないよ</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">右下の＋から追加してみよう</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* ブロック別表示 */}
          {BLOCKS.map((block) => {
            if (!hasBlockItems(block.key)) return null;
            const blockRoutines = getBlockRoutines(block.key);
            const blockTasks = getBlockTasks(block.key);

            return (
              <div key={block.key}>
                <div className="flex items-center gap-2.5 py-3 px-1">
                  <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">{block.label}</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                </div>
                <div className="space-y-2">
                  {blockRoutines.map((routine) => (
                    <RoutineItem
                      key={`r-${routine.id}`}
                      routine={routine}
                      completed={routine.id !== undefined && completionSet.has(routine.id)}
                      onToggle={() => routine.id !== undefined && toggleRoutine(routine.id)}
                      onEdit={onEditRoutine}
                      onDelete={deleteRoutine}
                      soundEnabled={settings?.soundEnabled !== false}
                    />
                  ))}
                  {blockTasks.map((task) => (
                    <TaskItem
                      key={`t-${task.id}`}
                      task={task}
                      category={getCategoryForTask(task.categoryId)}
                      onToggle={toggleTask}
                      onDelete={deleteTask}
                      onEdit={onEditTask}
                      onAddSubtask={onAddSubtask}
                      settings={settings}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* いつでもセクション */}
          {unblockedTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-2.5 py-3 px-1">
                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">いつでも</span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="space-y-2">
                {unblockedTasks.map((task) => (
                  <TaskItem
                    key={`t-${task.id}`}
                    task={task}
                    category={getCategoryForTask(task.categoryId)}
                    onToggle={toggleTask}
                    onDelete={deleteTask}
                    onEdit={onEditTask}
                    onAddSubtask={onAddSubtask}
                    settings={settings}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
