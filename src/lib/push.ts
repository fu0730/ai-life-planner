'use client';

import { supabase } from '@/lib/supabase';
import type { ReminderType } from '@/types';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** 通知の許可状態を取得 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/** 通知の許可をリクエストして購読登録 */
export async function subscribeToPush(): Promise<boolean> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });

    // サーバーに購読情報を送信
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    });

    return res.ok;
  } catch (err) {
    console.error('プッシュ通知の登録に失敗:', err);
    return false;
  }
}

/** 購読を解除 */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;

    // サーバーから購読情報を削除
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    await subscription.unsubscribe();
    return true;
  } catch (err) {
    console.error('プッシュ通知の解除に失敗:', err);
    return false;
  }
}

/** 現在購読中かチェック */
export async function isPushSubscribed(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

/** リマインド通知をスケジュール登録 */
export async function scheduleReminder(
  taskId: number,
  taskTitle: string,
  dueDate: string,
  reminder: ReminderType
): Promise<void> {
  if (!reminder || !dueDate) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    // 購読IDを取得
    const { data: sub } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', subscription.endpoint)
      .single();
    if (!sub) return;

    // 既存の同じタスクの通知を削除
    await supabase
      .from('scheduled_notifications')
      .delete()
      .eq('task_id', taskId)
      .eq('sent', false);

    // 通知時刻を計算（複数件）
    const now = new Date();
    const notifications = buildNotifications(dueDate, reminder, taskTitle).filter(
      (n) => n.notifyAt > now
    );
    if (notifications.length === 0) return;

    await supabase.from('scheduled_notifications').insert(
      notifications.map((n) => ({
        subscription_id: sub.id,
        title: 'リマインド',
        body: n.body,
        notify_at: n.notifyAt.toISOString(),
        task_id: taskId,
        type: 'reminder',
      }))
    );
  } catch (err) {
    console.error('リマインド登録エラー:', err);
  }
}

/** タスクのリマインド通知を削除 */
export async function cancelReminder(taskId: number): Promise<void> {
  try {
    await supabase
      .from('scheduled_notifications')
      .delete()
      .eq('task_id', taskId)
      .eq('sent', false);
  } catch (err) {
    console.error('リマインド削除エラー:', err);
  }
}

function buildNotifications(
  dueDate: string,
  reminder: ReminderType,
  taskTitle: string
): { notifyAt: Date; body: string }[] {
  if (!reminder) return [];
  const [year, month, day] = dueDate.split('-').map(Number);
  const morning = {
    notifyAt: new Date(year, month - 1, day, 8, 0), // 当日朝8時
    body: `今日が期限です: ${taskTitle}`,
  };
  const dayBefore = {
    notifyAt: new Date(year, month - 1, day - 1, 20, 0), // 前日夜8時
    body: `明日が期限です: ${taskTitle}`,
  };
  if (reminder === 'morning') return [morning];
  if (reminder === 'day-before') return [dayBefore];
  if (reminder === 'both') return [dayBefore, morning];
  return [];
}
