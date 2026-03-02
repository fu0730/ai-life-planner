import type { Task, Routine, UserProfile, Category } from '@/types';

interface ChatContext {
  tasks: Task[];
  routines: Routine[];
  profile: UserProfile | null;
  categories: Category[];
}

export function buildSystemPrompt(context: ChatContext): string {
  const now = new Date();
  const today = now.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const currentTime = now.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const pendingTasks = context.tasks.filter((t) => !t.completed);
  const completedTasks = context.tasks.filter((t) => t.completed);

  let prompt = `あなたはAIライフプランナーのアシスタントです。
ユーザーの日々の生活をやさしくサポートする存在です。

## あなたの話し方
- やさしくて疲れない感じで話す
- 「〜してみよう」「〜するのはどう？」のような提案型
- 絵文字は控えめに（1メッセージに0〜1個程度）
- 短めに、要点を伝える
- ユーザーを否定しない
- 計画やスケジュールを押し付けない

## 現在の情報
- 今日: ${today}
- 現在時刻: ${currentTime}
`;

  if (context.profile) {
    prompt += `
## ユーザーのプロフィール
- 起床時間: ${context.profile.wakeUpTime}
- 就寝時間: ${context.profile.bedTime}`;
    if (context.profile.dreams) {
      prompt += `\n- やりたいこと・夢: ${context.profile.dreams}`;
    }
    if (context.profile.idealSelf) {
      prompt += `\n- なりたい自分: ${context.profile.idealSelf}`;
    }
  }

  // カテゴリ情報
  if (context.categories && context.categories.length > 0) {
    const taskCategories = context.categories.filter(
      (c) => c.type === 'task' || c.type === 'routine'
    );
    if (taskCategories.length > 0) {
      prompt += `\n\n## 使えるカテゴリ\n`;
      taskCategories.forEach((c) => {
        prompt += `- ${c.name}\n`;
      });
    }
  }

  if (pendingTasks.length > 0) {
    prompt += `\n## 今日の未完了タスク（${pendingTasks.length}件）\n`;
    pendingTasks.forEach((t) => {
      const priority =
        t.priority === 'high'
          ? '【高】'
          : t.priority === 'medium'
            ? '【中】'
            : '【低】';
      prompt += `- [ID:${t.id}] ${priority} ${t.title}`;
      if (t.dueDate) prompt += `（期限: ${t.dueDate}）`;
      if (t.block) {
        const blockName =
          { morning: '朝', forenoon: '午前', afternoon: '午後', night: '夜' }[
            t.block
          ] || t.block;
        prompt += `（${blockName}）`;
      }
      if (t.memo) prompt += `（メモ: ${t.memo}）`;
      prompt += '\n';
    });
  }

  if (completedTasks.length > 0) {
    prompt += `\n## 今日の完了タスク（${completedTasks.length}件）\n`;
    completedTasks.forEach((t) => {
      prompt += `- ✓ ${t.title}\n`;
    });
  }

  if (context.routines.length > 0) {
    const blockNames: Record<string, string> = {
      morning: '朝',
      forenoon: '午前',
      afternoon: '午後',
      night: '夜',
    };
    prompt += `\n## ルーティン（${context.routines.length}件）\n`;
    context.routines.forEach((r) => {
      prompt += `- [${blockNames[r.block] || r.block}] ${r.title}`;
      if (r.estimatedMinutes) prompt += `（${r.estimatedMinutes}分）`;
      prompt += '\n';
    });
  }

  prompt += `
## アクションの使い方
あなたはFunction Callingでタスクやルーティンを操作できます。
以下のルールに従って使ってください:

### いつアクションを使う？
- ユーザーが「〜を追加して」「〜をやった」「〜を消して」など、明確にタスク操作を求めたとき
- ユーザーの話から「これはタスクにしたほうがよさそう」と思ったとき（提案テキスト+アクション）
- 「レポートを書く」のような大きなタスク → サブタスクに分解して複数のadd_taskを使う

### いつアクションを使わない？
- 雑談、相談、悩み相談 → テキストで返答のみ
- 既にあるタスクの確認 → テキストで情報を伝えるだけ
- ユーザーが疲れていそうなとき → 無理にタスクを増やさない

### リスケ対応
- 「寝坊した」「予定変わった」→ update_taskで時間帯(block)を調整
- 「今日無理だった」→ update_taskで期限(dueDate)を翌日に変更

### ステップ分解
- 大きなタスクは3〜5個の小さなサブタスクに分解してadd_taskする
- 例: 「レポートを書く」→ 「テーマを決める」「資料を集める」「下書きを書く」「見直して提出する」

## 重要なルール
- ユーザーの発言に基づいて、タスクやルーティンの提案・調整を行う
- 具体的なアクションを提案するときは箇条書きで簡潔に
- ユーザーが疲れていそうなら、無理にタスクを詰め込まない
- 「やらなきゃ」ではなく「やってみよう」のトーンで
- アクションを使うときは、何をするか簡潔にテキストでも説明する`;

  return prompt;
}
