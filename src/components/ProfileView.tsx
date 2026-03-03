'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { TimeMode, DaySchedule } from '@/types';

interface ProfileViewProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChat?: (message: string) => void;
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

const DEFAULT_DAY_SCHEDULES: Record<number, DaySchedule> = {
  0: { wakeUpTime: '08:00', bedTime: '23:00' },
  1: { wakeUpTime: '07:00', bedTime: '23:00' },
  2: { wakeUpTime: '07:00', bedTime: '23:00' },
  3: { wakeUpTime: '07:00', bedTime: '23:00' },
  4: { wakeUpTime: '07:00', bedTime: '23:00' },
  5: { wakeUpTime: '07:00', bedTime: '23:00' },
  6: { wakeUpTime: '08:00', bedTime: '24:00' },
};

export default function ProfileView({ isOpen, onClose, onOpenChat }: ProfileViewProps) {
  const [timeMode, setTimeMode] = useState<TimeMode>('fixed');
  const [wakeUpTime, setWakeUpTime] = useState('07:00');
  const [bedTime, setBedTime] = useState('23:00');
  const [daySchedules, setDaySchedules] = useState<Record<number, DaySchedule>>(DEFAULT_DAY_SCHEDULES);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [dreams, setDreams] = useState('');
  const [idealSelf, setIdealSelf] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);

  const userProfile = useLiveQuery(() => db.userProfile.toCollection().first());

  useEffect(() => {
    if (userProfile && !profileLoaded) {
      setTimeMode(userProfile.timeMode || 'fixed');
      setWakeUpTime(userProfile.wakeUpTime || '07:00');
      setBedTime(userProfile.bedTime || '23:00');
      if (userProfile.daySchedules) {
        setDaySchedules({ ...DEFAULT_DAY_SCHEDULES, ...userProfile.daySchedules });
      }
      setDreams(userProfile.dreams || '');
      setIdealSelf(userProfile.idealSelf || '');
      setProfileLoaded(true);
    }
  }, [userProfile, profileLoaded]);

  useEffect(() => {
    if (!isOpen) setProfileLoaded(false);
  }, [isOpen]);

  const saveProfile = async (updates: Record<string, unknown>) => {
    const profile = await db.userProfile.toCollection().first();
    if (profile?.id) {
      await db.userProfile.update(profile.id, updates);
    }
  };

  const handleTimeModeChange = (mode: TimeMode) => {
    setTimeMode(mode);
    saveProfile({ timeMode: mode });
  };

  const handleDayScheduleChange = (day: number, field: 'wakeUpTime' | 'bedTime', value: string | null) => {
    const updated = { ...daySchedules, [day]: { ...daySchedules[day], [field]: value } };
    setDaySchedules(updated);
    saveProfile({ daySchedules: updated });
  };

  const toggleDayAi = (day: number) => {
    const current = daySchedules[day];
    const isAi = current.wakeUpTime === null && current.bedTime === null;
    const updated = {
      ...daySchedules,
      [day]: isAi
        ? { wakeUpTime: wakeUpTime || '07:00', bedTime: bedTime || '23:00' }
        : { wakeUpTime: null, bedTime: null },
    };
    setDaySchedules(updated);
    saveProfile({ daySchedules: updated });
  };

  const handleAiSuggest = () => {
    const parts = [];
    if (dreams) parts.push(`やりたいこと: ${dreams}`);
    if (idealSelf) parts.push(`なりたい自分: ${idealSelf}`);
    if (timeMode === 'fixed') {
      parts.push(`起床: ${wakeUpTime}`, `就寝: ${bedTime}`);
    } else if (timeMode === 'ai') {
      parts.push('起床/就寝はAIにお任せ');
    }
    const profileInfo = parts.length > 0 ? `\n（${parts.join('、')}）` : '';
    const message = `私のプロフィールを元に、おすすめのルーティンとタスクを提案して！${profileInfo}`;
    onOpenChat?.(message);
  };

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

  return (
    <div className="fixed inset-0 bg-black/30 z-50 animate-overlay" role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={onClose}>
      <div
        className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-gray-900 shadow-xl overflow-y-auto animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 id="profile-title" className="text-lg font-bold text-gray-800 dark:text-gray-100">プロフィール</h2>
            <button
              onClick={onClose}
              aria-label="プロフィールを閉じる"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 active:scale-90 transition-transform"
            >
              ✕
            </button>
          </div>

          <div className="space-y-5">
            {/* 生活リズム */}
            <section>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-2 block">生活リズム</label>
              <div className="flex gap-1.5 mb-3">
                {([
                  { mode: 'fixed' as TimeMode, label: '毎日同じ' },
                  { mode: 'by-day' as TimeMode, label: '曜日ごと' },
                  { mode: 'ai' as TimeMode, label: 'AIにお任せ' },
                ]).map(({ mode, label }) => (
                  <button
                    key={mode}
                    onClick={() => handleTimeModeChange(mode)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                      timeMode === mode
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 毎日同じ */}
              {timeMode === 'fixed' && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5 block">起床</label>
                    <input
                      type="time"
                      value={wakeUpTime}
                      onChange={(e) => {
                        setWakeUpTime(e.target.value);
                        saveProfile({ wakeUpTime: e.target.value });
                      }}
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5 block">就寝</label>
                    <input
                      type="time"
                      value={bedTime}
                      onChange={(e) => {
                        setBedTime(e.target.value);
                        saveProfile({ bedTime: e.target.value });
                      }}
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                </div>
              )}

              {/* 曜日ごと */}
              {timeMode === 'by-day' && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden divide-y divide-gray-200 dark:divide-gray-700">
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                    const schedule = daySchedules[day];
                    const isAi = schedule.wakeUpTime === null && schedule.bedTime === null;
                    const isExpanded = openDay === day;
                    return (
                      <div key={day}>
                        {/* 閉じた状態: 1行サマリー */}
                        <button
                          onClick={() => setOpenDay(isExpanded ? null : day)}
                          className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <span className={`text-sm font-medium ${day === 0 ? 'text-red-400' : day === 6 ? 'text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                            {DAY_LABELS[day]}
                          </span>
                          <span className={`text-xs ${isAi ? 'text-purple-500 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'}`}>
                            {isAi ? 'AIお任せ' : `${schedule.wakeUpTime} 〜 ${schedule.bedTime}`}
                          </span>
                        </button>
                        {/* 開いた状態: 編集エリア */}
                        {isExpanded && (
                          <div className="px-3.5 pb-3 pt-1 bg-white dark:bg-gray-800/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400">{DAY_LABELS[day]}曜日の設定</span>
                              <button
                                onClick={() => toggleDayAi(day)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                                  isAi
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                                }`}
                              >
                                {isAi ? 'AIお任せ中' : 'AIに任せる'}
                              </button>
                            </div>
                            {!isAi && (
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <label className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5 block">起床</label>
                                  <input
                                    type="time"
                                    value={schedule.wakeUpTime || '07:00'}
                                    onChange={(e) => handleDayScheduleChange(day, 'wakeUpTime', e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5 block">就寝</label>
                                  <input
                                    type="time"
                                    value={schedule.bedTime || '23:00'}
                                    onChange={(e) => handleDayScheduleChange(day, 'bedTime', e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* AIにお任せ */}
              {timeMode === 'ai' && (
                <div className="text-center py-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                  <p className="text-sm text-purple-600 dark:text-purple-400 mb-1">その日の予定に合わせて</p>
                  <p className="text-sm text-purple-600 dark:text-purple-400">AIが最適な時間を提案します</p>
                </div>
              )}

              <button
                onClick={() => {
                  const parts = [];
                  if (dreams) parts.push(`やりたいこと: ${dreams}`);
                  if (idealSelf) parts.push(`なりたい自分: ${idealSelf}`);
                  const info = parts.length > 0 ? `（${parts.join('、')}）` : '';
                  if (timeMode === 'ai') {
                    onOpenChat?.(`生活リズムをAIにお任せにしてるんだけど、私に合った起床・就寝時間を提案して！${info}`);
                  } else {
                    const current = timeMode === 'fixed' ? `今は起床${wakeUpTime}、就寝${bedTime}` : '曜日ごとに設定してる';
                    onOpenChat?.(`起きる時間と寝る時間を一緒に考えてほしい！${current}んだけど、どう思う？${info}`);
                  }
                }}
                className="w-full mt-3 py-2 rounded-xl text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                ✨ AIに生活リズムを相談する
              </button>
            </section>

            {/* やりたいこと・夢 */}
            <section>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">やりたいこと・夢</label>
              <textarea
                value={dreams}
                onChange={(e) => {
                  setDreams(e.target.value);
                  saveProfile({ dreams: e.target.value });
                  const t = e.target;
                  t.style.height = 'auto';
                  t.style.height = t.scrollHeight + 'px';
                }}
                ref={(el) => {
                  if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
                }}
                placeholder="例: プログラミングを学びたい、健康的な生活をしたい"
                rows={2}
                className="w-full px-3 py-3 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder-gray-400 dark:placeholder-gray-500"
                style={{ minHeight: '60px' }}
              />
              <button
                onClick={() => {
                  const current = dreams ? `今は「${dreams}」って書いてるんだけど、もっと広げたり整理したりしたい！` : 'やりたいことや夢がまだうまく言葉にできないから、一緒に考えてほしい！';
                  onOpenChat?.(current);
                }}
                className="mt-1.5 text-xs text-purple-500 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
              >
                ✨ AIと一緒に考える
              </button>
            </section>

            {/* なりたい自分 */}
            <section>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">なりたい自分</label>
              <textarea
                value={idealSelf}
                onChange={(e) => {
                  setIdealSelf(e.target.value);
                  saveProfile({ idealSelf: e.target.value });
                  const t = e.target;
                  t.style.height = 'auto';
                  t.style.height = t.scrollHeight + 'px';
                }}
                ref={(el) => {
                  if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
                }}
                placeholder="例: 自分に自信が持てる人、毎日充実している人"
                rows={2}
                className="w-full px-3 py-3 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder-gray-400 dark:placeholder-gray-500"
                style={{ minHeight: '60px' }}
              />
              <button
                onClick={() => {
                  const current = idealSelf ? `今は「${idealSelf}」って書いてるんだけど、もっと深掘りしたい！` : 'なりたい自分がまだはっきりしないから、一緒に考えてほしい！';
                  onOpenChat?.(current);
                }}
                className="mt-1.5 text-xs text-purple-500 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
              >
                ✨ AIと一緒に考える
              </button>
            </section>

            {/* まとめて提案 */}
            <button
              onClick={handleAiSuggest}
              className="w-full py-3 rounded-xl text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
            >
              ✨ AIにルーティン・タスクを提案してもらう
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
