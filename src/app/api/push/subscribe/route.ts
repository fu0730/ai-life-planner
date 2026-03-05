import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// 購読登録
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const subscription = await req.json();

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      console.error('購読保存エラー:', error);
      return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// 購読解除
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { endpoint } = await req.json();

    // 関連する通知スケジュールも一緒に削除される（CASCADE）
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);

    if (error) {
      console.error('購読削除エラー:', error);
      return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
