'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ChatMessage, TimeBlock } from '@/types';
import type { AIAction } from '@/lib/ai-actions';

interface ChatViewProps {
  isOpen: boolean;
  onClose: () => void;
  initialMessage?: string;
}

const SUGGEST_CHIPS = [
  '今日のプランを提案して',
  'タスクを追加して',
  'ルーティンを見直して',
];

export default function ChatView({ isOpen, onClose, initialMessage }: ChatViewProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [pendingActions, setPendingActions] = useState<AIAction[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = useLiveQuery(
    () => db.chatMessages.orderBy('createdAt').toArray(),
    []
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // 新しいメッセージが来たら下にスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // 開いたときにinputにフォーカス
  useEffect(() => {
    if (isOpen && !initialMessage) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, initialMessage]);

  // initialMessageが指定されたら自動送信
  const initialMessageSentRef = useRef<string | null>(null);
  useEffect(() => {
    if (isOpen && initialMessage && initialMessageSentRef.current !== initialMessage) {
      initialMessageSentRef.current = initialMessage;
      setTimeout(() => handleSend(initialMessage), 400);
    }
  }, [isOpen, initialMessage]);

  const gatherContext = async () => {
    const today = new Date().toISOString().split('T')[0];
    const tasks = await db.tasks
      .where('createdAt')
      .above(today + 'T00:00:00')
      .toArray();
    // 今日のタスクがなければ未完了タスクを取得
    const allTasks =
      tasks.length > 0
        ? tasks
        : await db.tasks.where('completed').equals(0).toArray();
    const routines = await db.routines.toArray();
    const profile = (await db.userProfile.toCollection().first()) || null;
    const categories = await db.categories.toArray();
    return { tasks: allTasks, routines, profile, categories };
  };

  // アクション実行
  const executeAction = async (
    action: AIAction,
    messageId: number,
    actionIndex: number
  ) => {
    try {
      switch (action.type) {
        case 'add_task': {
          const p = action.params;
          let categoryId = 1;
          if (p.categoryName) {
            const categories = await db.categories.toArray();
            const found = categories.find(
              (c) =>
                c.name === p.categoryName ||
                c.name.includes(p.categoryName as string)
            );
            if (found?.id) categoryId = found.id;
          }
          await db.tasks.add({
            title: p.title as string,
            categoryId,
            completed: false,
            priority:
              (p.priority as 'high' | 'medium' | 'low') || 'medium',
            dueDate: p.dueDate as string | undefined,
            block: p.block as TimeBlock | undefined,
            memo: p.memo as string | undefined,
            createdAt: new Date().toISOString(),
          });
          break;
        }
        case 'complete_task': {
          const p = action.params;
          let taskId = p.taskId as number | undefined;
          if (!taskId && p.taskTitle) {
            const allTasks = await db.tasks
              .where('completed')
              .equals(0)
              .toArray();
            const found = allTasks.find(
              (t) =>
                t.title === p.taskTitle ||
                t.title.includes(p.taskTitle as string)
            );
            taskId = found?.id;
          }
          if (taskId) {
            await db.tasks.update(taskId, {
              completed: true,
              completedAt: new Date().toISOString(),
            });
          }
          break;
        }
        case 'update_task': {
          const p = action.params;
          let taskId = p.taskId as number | undefined;
          if (!taskId && p.taskTitle) {
            const allTasks = await db.tasks.toArray();
            const found = allTasks.find(
              (t) =>
                t.title === p.taskTitle ||
                t.title.includes(p.taskTitle as string)
            );
            taskId = found?.id;
          }
          if (taskId) {
            const updates: Record<string, unknown> = {};
            if (p.title) updates.title = p.title;
            if (p.priority) updates.priority = p.priority;
            if (p.dueDate) updates.dueDate = p.dueDate;
            if (p.block) updates.block = p.block;
            if (p.memo !== undefined) updates.memo = p.memo;
            await db.tasks.update(taskId, updates);
          }
          break;
        }
        case 'delete_task': {
          const p = action.params;
          let taskId = p.taskId as number | undefined;
          if (!taskId && p.taskTitle) {
            const allTasks = await db.tasks.toArray();
            const found = allTasks.find(
              (t) =>
                t.title === p.taskTitle ||
                t.title.includes(p.taskTitle as string)
            );
            taskId = found?.id;
          }
          if (taskId) {
            await db.tasks.delete(taskId);
          }
          break;
        }
        case 'add_routine': {
          const p = action.params;
          const routineCount = await db.routines.count();
          await db.routines.add({
            title: p.title as string,
            block: p.block as TimeBlock,
            estimatedMinutes: p.estimatedMinutes as number | undefined,
            days: (p.days as number[]) || [0, 1, 2, 3, 4, 5, 6],
            order: routineCount,
            createdAt: new Date().toISOString(),
          });
          break;
        }
      }

      // DBでアクションを「実行済み」にマーク
      const msg = await db.chatMessages.get(messageId);
      if (msg?.actions) {
        const actions: AIAction[] = JSON.parse(msg.actions);
        actions[actionIndex] = { ...actions[actionIndex], executed: true };
        await db.chatMessages.update(messageId, {
          actions: JSON.stringify(actions),
        });
      }
    } catch (error) {
      console.error('Action execution error:', error);
    }
  };

  // 一括実行
  const executeAllActions = async (messageId: number) => {
    const msg = await db.chatMessages.get(messageId);
    if (!msg?.actions) return;
    const actions: AIAction[] = JSON.parse(msg.actions);
    for (let i = 0; i < actions.length; i++) {
      if (actions[i].type !== 'suggest_plan' && !actions[i].executed) {
        await executeAction(actions[i], messageId, i);
      }
    }
  };

  const handleSend = async (text?: string) => {
    const trimmed = (text || input).trim();
    if (!trimmed || isLoading) return;

    // ユーザーメッセージをDBに保存
    await db.chatMessages.add({
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    });

    setInput('');
    setIsLoading(true);
    setStreamingContent('');
    setPendingActions([]);

    try {
      const context = await gatherContext();

      // 直近の会話履歴（最大20件）
      const recentMessages = (messages || []).slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: recentMessages,
          context,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'APIエラーが発生しました');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ストリームを取得できませんでした');

      const decoder = new TextDecoder();
      let fullContent = '';
      let collectedActions: AIAction[] = [];
      let lineBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        lineBuffer += chunk;
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'actions') {
              collectedActions = parsed.data;
              setPendingActions(parsed.data);
            } else if (parsed.type === 'text') {
              fullContent += parsed.content;
              setStreamingContent(fullContent);
            }
          } catch {
            // 不正な行はスキップ
          }
        }
      }

      // バッファに残ったデータを処理
      if (lineBuffer.trim()) {
        try {
          const parsed = JSON.parse(lineBuffer);
          if (parsed.type === 'text') {
            fullContent += parsed.content;
          } else if (parsed.type === 'actions') {
            collectedActions = parsed.data;
          }
        } catch {
          // スキップ
        }
      }

      // アシスタントメッセージをDBに保存
      await db.chatMessages.add({
        role: 'assistant',
        content: fullContent,
        actions:
          collectedActions.length > 0
            ? JSON.stringify(collectedActions)
            : undefined,
        createdAt: new Date().toISOString(),
      });

      setStreamingContent('');
      setPendingActions([]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'エラーが発生しました';
      await db.chatMessages.add({
        role: 'assistant',
        content: `申し訳ありません、エラーが発生しました: ${errorMessage}`,
        createdAt: new Date().toISOString(),
      });
      setStreamingContent('');
      setPendingActions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = async () => {
    if (confirm('チャット履歴をすべて削除しますか？')) {
      await db.chatMessages.clear();
    }
  };

  if (!isOpen) return null;

  const isEmpty =
    (!messages || messages.length === 0) && !streamingContent && !isLoading;

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 animate-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-title"
      onClick={onClose}
    >
      <div
        className="fixed right-0 top-0 w-full max-w-sm h-[100dvh] bg-white dark:bg-gray-900 shadow-xl flex flex-col animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <h2
              id="chat-title"
              className="text-lg font-bold text-gray-800 dark:text-gray-100"
            >
              AIアシスタント
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {messages && messages.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 transition-colors"
              >
                履歴削除
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="チャットを閉じる"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 active:scale-90 transition-transform"
            >
              ✕
            </button>
          </div>
        </div>

        {/* メッセージ一覧 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isEmpty && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="text-4xl mb-3">✨</span>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                なんでも聞いてみてね
              </p>
              {/* サジェストチップ */}
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGEST_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleSend(chip)}
                    className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors border border-gray-200 dark:border-gray-700"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages?.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onExecuteAction={executeAction}
              onExecuteAll={executeAllActions}
            />
          ))}

          {/* ストリーミング中のアクション + テキスト表示 */}
          {(pendingActions.length > 0 || streamingContent) && (
            <div className="flex justify-start">
              <div className="max-w-[85%] space-y-2">
                {pendingActions.filter((a) => a.type !== 'suggest_plan')
                  .length > 0 && (
                  <div className="space-y-1.5 opacity-70">
                    {pendingActions
                      .filter((a) => a.type !== 'suggest_plan')
                      .map((action, i) => (
                        <StreamingActionCard key={i} action={action} />
                      ))}
                  </div>
                )}
                {streamingContent && (
                  <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap break-words">
                    {streamingContent}
                    <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-0.5 align-middle" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ローディング表示 */}
          {isLoading && !streamingContent && pendingActions.length === 0 && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-gray-100 dark:bg-gray-800">
                <div className="flex gap-1.5">
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 入力エリア */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="メッセージを入力..."
              rows={1}
              className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 placeholder-gray-400 dark:placeholder-gray-500 max-h-32"
              style={{ minHeight: '42px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height =
                  Math.min(target.scrollHeight, 128) + 'px';
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              aria-label="送信"
              className="w-10 h-10 flex items-center justify-center bg-blue-500 text-white rounded-full disabled:opacity-40 hover:bg-blue-600 active:scale-90 transition-all flex-shrink-0"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 12h14M12 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- サブコンポーネント ---

function getActionInfo(action: AIAction): {
  icon: string;
  label: string;
  detail: string;
} {
  const p = action.params || {};
  switch (action.type) {
    case 'add_task':
      return {
        icon: '+',
        label: 'タスク追加',
        detail: (p.title as string) || '',
      };
    case 'complete_task':
      return {
        icon: '✓',
        label: 'タスク完了',
        detail: (p.taskTitle as string) || `ID:${p.taskId}`,
      };
    case 'update_task':
      return {
        icon: '~',
        label: 'タスク変更',
        detail:
          (p.taskTitle as string) ||
          (p.title as string) ||
          `ID:${p.taskId}`,
      };
    case 'delete_task':
      return {
        icon: '×',
        label: 'タスク削除',
        detail: (p.taskTitle as string) || `ID:${p.taskId}`,
      };
    case 'add_routine':
      return {
        icon: '↻',
        label: 'ルーティン追加',
        detail: (p.title as string) || '',
      };
    default:
      return { icon: '•', label: action.type, detail: '' };
  }
}

/** ストリーミング中のアクションカード（実行ボタンなし） */
function StreamingActionCard({ action }: { action: AIAction }) {
  const info = getActionInfo(action);
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm">
      <span className="text-gray-500 dark:text-gray-400 w-4 text-center">
        {info.icon}
      </span>
      <span className="text-gray-700 dark:text-gray-300">
        {info.label}: {info.detail}
      </span>
    </div>
  );
}

/** メッセージバブル */
function MessageBubble({
  message,
  onExecuteAction,
  onExecuteAll,
}: {
  message: ChatMessage;
  onExecuteAction: (
    action: AIAction,
    messageId: number,
    actionIndex: number
  ) => Promise<void>;
  onExecuteAll: (messageId: number) => Promise<void>;
}) {
  const isUser = message.role === 'user';
  const actions: AIAction[] = message.actions
    ? JSON.parse(message.actions)
    : [];
  const executableActions = actions.filter(
    (a) => a.type !== 'suggest_plan'
  );
  const hasUnexecuted = executableActions.some((a) => !a.executed);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-br-sm bg-blue-500 text-white text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        {/* アクションカード */}
        {executableActions.length > 0 && (
          <div className="space-y-1.5">
            {executableActions.length > 1 && hasUnexecuted && (
              <button
                onClick={() => onExecuteAll(message.id!)}
                className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 active:scale-95 transition-all"
              >
                すべて実行
              </button>
            )}
            {actions.map((action, i) => {
              if (action.type === 'suggest_plan') return null;
              const info = getActionInfo(action);
              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-400 dark:text-gray-500 text-sm flex-shrink-0 w-4 text-center">
                      {info.icon}
                    </span>
                    <div className="min-w-0">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        {info.label}
                      </span>
                      <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                        {info.detail}
                      </p>
                    </div>
                  </div>
                  {action.executed ? (
                    <span className="text-xs text-green-600 dark:text-green-400 flex-shrink-0 px-2 py-1">
                      ✓ 完了
                    </span>
                  ) : (
                    <button
                      onClick={() =>
                        onExecuteAction(action, message.id!, i)
                      }
                      className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 active:scale-95 transition-all flex-shrink-0"
                    >
                      実行
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {/* テキスト */}
        {message.content && (
          <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
}
