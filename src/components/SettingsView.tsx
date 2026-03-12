'use client';

import { useState, useEffect, useCallback } from 'react';
import { updateSettings } from '@/lib/settings';
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed, getNotificationPermission } from '@/lib/push';
import { useAuth } from '@/lib/auth-context';
import type { Settings } from '@/types';

interface SettingsViewProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings | undefined;
}

export default function SettingsView({ isOpen, onClose, settings }: SettingsViewProps) {
  const { user, signOut } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

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

          {/* アカウント */}
          <section className="mb-8">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">アカウント</h3>
            {user && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 truncate">
                {user.email}
              </p>
            )}
            <button
              onClick={signOut}
              className="w-full py-3 rounded-xl text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
            >
              ログアウト
            </button>
          </section>

        </div>
      </div>
    </div>
  );
}
