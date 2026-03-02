import type { TimeBlock } from '@/types';

// AIが実行できるアクションの型
export interface AIAction {
  type: string;
  params: Record<string, unknown>;
  executed?: boolean;
}

export interface AddTaskAction extends AIAction {
  type: 'add_task';
  params: {
    title: string;
    categoryName?: string;
    priority?: 'high' | 'medium' | 'low';
    dueDate?: string;
    block?: TimeBlock;
    memo?: string;
  };
}

export interface CompleteTaskAction extends AIAction {
  type: 'complete_task';
  params: {
    taskId?: number;
    taskTitle?: string;
  };
}

export interface UpdateTaskAction extends AIAction {
  type: 'update_task';
  params: {
    taskId?: number;
    taskTitle?: string;
    title?: string;
    priority?: 'high' | 'medium' | 'low';
    dueDate?: string;
    block?: TimeBlock;
    memo?: string;
  };
}

export interface DeleteTaskAction extends AIAction {
  type: 'delete_task';
  params: {
    taskId?: number;
    taskTitle?: string;
  };
}

export interface AddRoutineAction extends AIAction {
  type: 'add_routine';
  params: {
    title: string;
    block: TimeBlock;
    estimatedMinutes?: number;
    days?: number[];
  };
}

// Gemini Function Calling用の宣言
export const aiFunctionDeclarations = [
  {
    name: 'add_task',
    description:
      'ユーザーの依頼に基づいてタスクを追加する。複数のタスクを追加する場合はこの関数を複数回呼ぶ。大きなタスクは小さなサブタスクに分解して追加する。',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'タスクのタイトル。具体的でわかりやすい名前にする。',
        },
        categoryName: {
          type: 'STRING',
          description:
            'カテゴリ名（例: 大学, 仕事, 買い物, 日常, やりたいこと）。ユーザーの発言内容から適切なカテゴリを推測する。',
        },
        priority: {
          type: 'STRING',
          enum: ['high', 'medium', 'low'],
          description: 'タスクの優先度。指定がなければmedium。',
        },
        dueDate: {
          type: 'STRING',
          description: '期限（YYYY-MM-DD形式）。明示されない場合は省略。',
        },
        block: {
          type: 'STRING',
          enum: ['morning', 'forenoon', 'afternoon', 'night'],
          description:
            '時間帯。morning=朝, forenoon=午前, afternoon=午後, night=夜。',
        },
        memo: {
          type: 'STRING',
          description: 'タスクのメモ・補足情報。',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_task',
    description:
      '指定されたタスクを完了にする。タスクIDまたはタイトルで指定できる。',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: {
          type: 'NUMBER',
          description: 'タスクのID（コンテキストに表示されているID）',
        },
        taskTitle: {
          type: 'STRING',
          description: 'タスクのタイトル（IDが不明な場合に使用）',
        },
      },
    },
  },
  {
    name: 'update_task',
    description:
      'タスクの内容を変更する（タイトル、優先度、期限、時間帯、メモ等）',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: {
          type: 'NUMBER',
          description: 'タスクのID',
        },
        taskTitle: {
          type: 'STRING',
          description: 'タスクのタイトル（IDが不明な場合に使用）',
        },
        title: {
          type: 'STRING',
          description: '新しいタイトル',
        },
        priority: {
          type: 'STRING',
          enum: ['high', 'medium', 'low'],
          description: '新しい優先度',
        },
        dueDate: {
          type: 'STRING',
          description: '新しい期限（YYYY-MM-DD形式）',
        },
        block: {
          type: 'STRING',
          enum: ['morning', 'forenoon', 'afternoon', 'night'],
          description: '新しい時間帯',
        },
        memo: {
          type: 'STRING',
          description: '新しいメモ',
        },
      },
    },
  },
  {
    name: 'delete_task',
    description: 'タスクを削除する。タスクIDまたはタイトルで指定できる。',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: {
          type: 'NUMBER',
          description: 'タスクのID',
        },
        taskTitle: {
          type: 'STRING',
          description: 'タスクのタイトル（IDが不明な場合に使用）',
        },
      },
    },
  },
  {
    name: 'add_routine',
    description: 'ルーティンを追加する。',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'ルーティンのタイトル',
        },
        block: {
          type: 'STRING',
          enum: ['morning', 'forenoon', 'afternoon', 'night'],
          description:
            '時間帯。morning=朝, forenoon=午前, afternoon=午後, night=夜。',
        },
        estimatedMinutes: {
          type: 'NUMBER',
          description: '予想所要時間（分）',
        },
        days: {
          type: 'ARRAY',
          items: { type: 'NUMBER' },
          description:
            '実施曜日（0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土）。省略時は毎日。',
        },
      },
      required: ['title', 'block'],
    },
  },
  {
    name: 'suggest_plan',
    description:
      '今日のプランを提案する。タスクやルーティンの情報に基づいて、おすすめの過ごし方をテキストで提案する。このアクションは直接的な変更を行わない。',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
];
