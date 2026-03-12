'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';
import { db } from './db';
import {
  categoriesApi, tasksApi, routinesApi, routineCompletionsApi,
  reflectionsApi, userProfileApi, settingsApi, chatMessagesApi,
  checkListsApi, checkListItemsApi, purchaseHistoryApi,
} from './supabase-db';
import { useLiveQuery } from 'dexie-react-hooks';
import type {
  Task, Category, Routine, RoutineCompletion,
  DailyReflection, UserProfile, Settings, ChatMessage,
  CheckList,
} from '@/types';

/**
 * オンライン（ログイン中）かどうか判定
 */
export function useIsOnline(): boolean {
  const { user } = useAuth();
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return !!user && online;
}

// リフレッシュ用のイベントバス
type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

function emitRefresh(table: string) {
  const set = listeners.get(table);
  if (set) set.forEach(fn => fn());
}

function useRefreshListener(table: string, callback: () => void) {
  useEffect(() => {
    if (!listeners.has(table)) listeners.set(table, new Set());
    const set = listeners.get(table)!;
    set.add(callback);
    return () => { set.delete(callback); };
  }, [table, callback]);
}

// Supabaseからデータを取得するフック
function useRemoteData<T>(fetcher: () => Promise<T>, table: string, isOnline: boolean): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined);

  const fetchRemote = useCallback(async () => {
    if (isOnline) {
      try {
        const result = await fetcher();
        setData(result);
      } catch (err) {
        console.error(`Error fetching ${table}:`, err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  useEffect(() => { fetchRemote(); }, [fetchRemote]);
  useRefreshListener(table, fetchRemote);

  return data;
}

// ============================================
// データフック
// ============================================

export function useCategories(): Category[] | undefined {
  const isOnline = useIsOnline();
  const localData = useLiveQuery(() => db.categories.orderBy('order').toArray());
  const remoteData = useRemoteData(() => categoriesApi.getAll(), 'categories', isOnline);
  return isOnline ? remoteData : localData;
}

export function useTasks(): Task[] | undefined {
  const isOnline = useIsOnline();
  const localData = useLiveQuery(() => db.tasks.toArray());
  const remoteData = useRemoteData(() => tasksApi.getAll(), 'tasks', isOnline);
  return isOnline ? remoteData : localData;
}

export function useRoutines(): Routine[] | undefined {
  const isOnline = useIsOnline();
  const localData = useLiveQuery(() => db.routines.toArray());
  const remoteData = useRemoteData(() => routinesApi.getAll(), 'routines', isOnline);
  return isOnline ? remoteData : localData;
}

export function useRoutineCompletions(): RoutineCompletion[] | undefined {
  const isOnline = useIsOnline();
  const localData = useLiveQuery(() => db.routineCompletions.toArray());
  const remoteData = useRemoteData(() => routineCompletionsApi.getAll(), 'routine_completions', isOnline);
  return isOnline ? remoteData : localData;
}

export function useSettingsData(): Settings | undefined {
  const isOnline = useIsOnline();
  const localData = useLiveQuery(() => db.settings.toCollection().first());
  const remoteData = useRemoteData(
    async () => (await settingsApi.get()) ?? undefined,
    'user_settings',
    isOnline
  );
  return isOnline ? remoteData : localData;
}

export function useUserProfile(): UserProfile | undefined {
  const isOnline = useIsOnline();
  const localData = useLiveQuery(() => db.userProfile.toCollection().first());
  const remoteData = useRemoteData(
    async () => (await userProfileApi.get()) ?? undefined,
    'user_profiles',
    isOnline
  );
  return isOnline ? remoteData : localData;
}

export function useChatMessages(): ChatMessage[] | undefined {
  const isOnline = useIsOnline();
  const localData = useLiveQuery(() => db.chatMessages.orderBy('createdAt').toArray());
  const remoteData = useRemoteData(() => chatMessagesApi.getAll(), 'chat_messages', isOnline);
  return isOnline ? remoteData : localData;
}

export function useCheckLists(): CheckList[] | undefined {
  const isOnline = useIsOnline();
  const localData = useLiveQuery(() => db.checkLists.orderBy('order').toArray());
  const remoteData = useRemoteData(() => checkListsApi.getAll(), 'check_lists', isOnline);
  return isOnline ? remoteData : localData;
}

export function useReflections(): DailyReflection[] | undefined {
  const isOnline = useIsOnline();
  const localData = useLiveQuery(() => db.reflections.toArray());
  const remoteData = useRemoteData(() => reflectionsApi.getAll(), 'reflections', isOnline);
  return isOnline ? remoteData : localData;
}

// ============================================
// データ操作ヘルパー
// ============================================

export function useDataOperations() {
  const isOnline = useIsOnline();

  const refresh = useCallback((table: string) => {
    emitRefresh(table);
  }, []);

  return {
    isOnline,
    refresh,

    // --- Categories ---
    addCategory: async (data: Omit<Category, 'id'>) => {
      if (isOnline) {
        const id = await categoriesApi.add(data);
        refresh('categories');
        return id;
      }
      return await db.categories.add(data as Category);
    },
    updateCategory: async (id: number, data: Partial<Category>) => {
      if (isOnline) { await categoriesApi.update(id, data); refresh('categories'); }
      else await db.categories.update(id, data);
    },
    deleteCategory: async (id: number) => {
      if (isOnline) { await categoriesApi.delete(id); refresh('categories'); }
      else await db.categories.delete(id);
    },
    bulkAddCategories: async (items: Omit<Category, 'id'>[]) => {
      if (isOnline) { await categoriesApi.bulkAdd(items); refresh('categories'); }
      else await db.categories.bulkAdd(items as Category[]);
    },

    // --- Tasks ---
    addTask: async (data: Omit<Task, 'id'>) => {
      if (isOnline) {
        const id = await tasksApi.add(data);
        refresh('tasks');
        return id;
      }
      return await db.tasks.add(data as Task);
    },
    updateTask: async (id: number, data: Partial<Task>) => {
      if (isOnline) { await tasksApi.update(id, data); refresh('tasks'); }
      else await db.tasks.update(id, data);
    },
    deleteTask: async (id: number) => {
      if (isOnline) { await tasksApi.delete(id); refresh('tasks'); }
      else await db.tasks.delete(id);
    },
    bulkAddTasks: async (items: Omit<Task, 'id'>[]) => {
      if (isOnline) {
        const ids = await tasksApi.bulkAdd(items);
        refresh('tasks');
        return ids;
      }
      await db.tasks.bulkAdd(items as Task[]);
      return [];
    },
    bulkDeleteTasks: async (ids: number[]) => {
      if (isOnline) { await tasksApi.bulkDelete(ids); refresh('tasks'); }
      else await db.tasks.bulkDelete(ids);
    },
    getTasksByParentId: async (parentId: number): Promise<Task[]> => {
      if (isOnline) return await tasksApi.getByParentId(parentId);
      return await db.tasks.where('parentId').equals(parentId).toArray();
    },

    // --- Routines ---
    addRoutine: async (data: Omit<Routine, 'id'>) => {
      if (isOnline) {
        const id = await routinesApi.add(data);
        refresh('routines');
        return id;
      }
      return await db.routines.add(data as Routine);
    },
    updateRoutine: async (id: number, data: Partial<Routine>) => {
      if (isOnline) { await routinesApi.update(id, data); refresh('routines'); }
      else await db.routines.update(id, data);
    },
    deleteRoutine: async (id: number) => {
      if (isOnline) { await routinesApi.delete(id); refresh('routines'); }
      else await db.routines.delete(id);
    },
    countRoutinesByBlock: async (block: string): Promise<number> => {
      if (isOnline) return await routinesApi.countByBlock(block);
      return await db.routines.where('block').equals(block).count();
    },

    // --- Routine Completions ---
    addRoutineCompletion: async (data: Omit<RoutineCompletion, 'id'>) => {
      if (isOnline) {
        const id = await routineCompletionsApi.add(data);
        refresh('routine_completions');
        return id;
      }
      return await db.routineCompletions.add(data as RoutineCompletion);
    },
    deleteRoutineCompletion: async (id: number) => {
      if (isOnline) { await routineCompletionsApi.delete(id); refresh('routine_completions'); }
      else await db.routineCompletions.delete(id);
    },

    // --- Reflections ---
    addReflection: async (data: Omit<DailyReflection, 'id'>) => {
      if (isOnline) {
        const id = await reflectionsApi.add(data);
        refresh('reflections');
        return id;
      }
      return await db.reflections.add(data as DailyReflection);
    },
    updateReflection: async (id: number, data: Partial<DailyReflection>) => {
      if (isOnline) { await reflectionsApi.update(id, data); refresh('reflections'); }
      else await db.reflections.update(id, data);
    },

    // --- User Profile ---
    upsertProfile: async (data: Omit<UserProfile, 'id'>) => {
      if (isOnline) {
        await userProfileApi.upsert(data);
        refresh('user_profiles');
      } else {
        const existing = await db.userProfile.toCollection().first();
        if (existing?.id) await db.userProfile.update(existing.id, data);
        else await db.userProfile.add(data as UserProfile);
      }
    },

    // --- Settings ---
    getSettings: async (): Promise<Settings> => {
      const DEFAULT: Omit<Settings, 'id'> = {
        theme: 'light', soundEnabled: true, sortBy: 'priority', viewMode: 'list', setupCompleted: false,
      };
      if (isOnline) {
        const s = await settingsApi.get();
        if (s) return s;
        await settingsApi.upsert(DEFAULT);
        return { id: 0, ...DEFAULT };
      }
      const s = await db.settings.toCollection().first();
      if (s) return s;
      const id = await db.settings.add({ ...DEFAULT } as Settings);
      return { id, ...DEFAULT };
    },
    updateSettings: async (updates: Partial<Omit<Settings, 'id'>>) => {
      if (isOnline) { await settingsApi.update(updates); refresh('user_settings'); }
      else {
        const s = await db.settings.toCollection().first();
        if (s?.id) await db.settings.update(s.id, updates);
      }
    },

    // --- Chat Messages ---
    addChatMessage: async (data: Omit<ChatMessage, 'id'>) => {
      if (isOnline) {
        const id = await chatMessagesApi.add(data);
        refresh('chat_messages');
        return id;
      }
      return await db.chatMessages.add(data as ChatMessage);
    },
    updateChatMessage: async (id: number, data: Partial<ChatMessage>) => {
      if (isOnline) { await chatMessagesApi.update(id, data); refresh('chat_messages'); }
      else await db.chatMessages.update(id, data);
    },

    // --- Check Lists ---
    addCheckList: async (data: Omit<CheckList, 'id'>) => {
      if (isOnline) {
        const id = await checkListsApi.add(data);
        refresh('check_lists');
        return id;
      }
      return await db.checkLists.add(data as CheckList);
    },
    updateCheckList: async (id: number, data: Partial<CheckList>) => {
      if (isOnline) { await checkListsApi.update(id, data); refresh('check_lists'); }
      else await db.checkLists.update(id, data);
    },
    deleteCheckList: async (id: number) => {
      if (isOnline) {
        await checkListItemsApi.deleteByListId(id);
        await purchaseHistoryApi.deleteByListId(id);
        await checkListsApi.delete(id);
        refresh('check_lists');
      } else {
        await db.checkListItems.where('listId').equals(id).delete();
        await db.purchaseHistory.where('listId').equals(id).delete();
        await db.checkLists.delete(id);
      }
    },
    countCheckLists: async (): Promise<number> => {
      if (isOnline) return await checkListsApi.count();
      return await db.checkLists.count();
    },

    // --- Seed ---
    seedDefaultCategories: async () => {
      if (isOnline) {
        const existing = await categoriesApi.getAll();
        if (existing.length > 0) return;
        await categoriesApi.bulkAdd([
          { name: '大学', color: '#3B82F6', order: 0, type: 'task' },
          { name: '仕事', color: '#8B5CF6', order: 1, type: 'task' },
          { name: '日常', color: '#F59E0B', order: 2, type: 'task' },
          { name: 'やりたいこと', color: '#06B6D4', order: 3, type: 'task' },
        ]);
        refresh('categories');
      } else {
        const count = await db.categories.count();
        if (count > 0) return;
        await db.categories.bulkAdd([
          { name: '大学', color: '#3B82F6', order: 0, type: 'task' },
          { name: '仕事', color: '#8B5CF6', order: 1, type: 'task' },
          { name: '日常', color: '#F59E0B', order: 2, type: 'task' },
          { name: 'やりたいこと', color: '#06B6D4', order: 3, type: 'task' },
        ] as Category[]);
      }
    },
  };
}
