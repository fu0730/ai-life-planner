import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function initVapid() {
  webpush.setVapidDetails(
    'mailto:life-planner@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim()
  );
}

async function sendPendingNotifications(req: NextRequest) {
  try {
    initVapid();
    const supabase = getSupabase();

    // 簡易認証（Cronジョブ用）
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const now = new Date().toISOString();

    // 送信予定の通知を取得
    const { data: notifications, error: fetchError } = await supabase
      .from('scheduled_notifications')
      .select('*, push_subscriptions(*)')
      .eq('sent', false)
      .lte('notify_at', now);

    if (fetchError) {
      console.error('通知取得エラー:', fetchError);
      return NextResponse.json({ error: '取得に失敗' }, { status: 500 });
    }

    if (!notifications || notifications.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    let sentCount = 0;
    const failedIds: string[] = [];

    for (const notif of notifications) {
      const sub = notif.push_subscriptions;
      if (!sub) continue;

      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
      };

      try {
        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify({ title: notif.title, body: notif.body })
        );
        sentCount++;
      } catch (err: unknown) {
        console.error('通知送信エラー:', err);
        if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
          failedIds.push(sub.id);
        }
      }
    }

    // 送信済みにマーク
    const sentIds = notifications.map((n) => n.id);
    await supabase
      .from('scheduled_notifications')
      .update({ sent: true })
      .in('id', sentIds);

    // 無効な購読を削除
    if (failedIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', failedIds);
    }

    return NextResponse.json({ sent: sentCount });
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// Vercel CronはGETリクエストを送る
export async function GET(req: NextRequest) {
  return sendPendingNotifications(req);
}

export async function POST(req: NextRequest) {
  return sendPendingNotifications(req);
}
