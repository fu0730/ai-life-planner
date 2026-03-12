import { supabase } from './supabase';
import type {
  Task, Category, Routine, RoutineCompletion,
  DailyReflection, UserProfile, Settings, ChatMessage,
  CheckList, CheckListItem, PurchaseHistory,
} from '@/types';

// ============================================
// ヘルパー: snake_case ↔ camelCase 変換
// ============================================

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

function camelToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    result[snakeKey] = obj[key];
  }
  return result;
}

// user_id を取得
async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// ============================================
// 汎用 CRUD
// ============================================

async function fetchAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').order('id');
  if (error) throw error;
  return (data || []).map(row => snakeToCamel(row) as unknown as T);
}

async function insertOne<T extends Record<string, unknown>>(table: string, data: T): Promise<number> {
  const userId = await getUserId();
  const snaked = camelToSnake(data as Record<string, unknown>);
  // Dexieの自動採番IDは除外、user_idを追加
  const { id: _, ...rest } = snaked;
  const payload = { ...rest, user_id: userId };
  const { data: result, error } = await supabase.from(table).insert(payload).select('id').single();
  if (error) throw error;
  return result.id;
}

async function updateOne(table: string, id: number, updates: Record<string, unknown>): Promise<void> {
  const snaked = camelToSnake(updates);
  const { error } = await supabase.from(table).update(snaked).eq('id', id);
  if (error) throw error;
}

async function deleteOne(table: string, id: number): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

async function deleteWhere(table: string, column: string, value: unknown): Promise<void> {
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (error) throw error;
}

// ============================================
// テーブル別 API
// ============================================

// --- Categories ---
export const categoriesApi = {
  getAll: () => fetchAll<Category>('categories'),
  add: (data: Omit<Category, 'id'>) => insertOne('categories', data as unknown as Record<string, unknown>),
  update: (id: number, data: Partial<Category>) => updateOne('categories', id, data as Record<string, unknown>),
  delete: (id: number) => deleteOne('categories', id),
  bulkAdd: async (items: Omit<Category, 'id'>[]) => {
    const userId = await getUserId();
    const rows = items.map(item => ({ ...camelToSnake(item as unknown as Record<string, unknown>), user_id: userId }));
    const { error } = await supabase.from('categories').insert(rows);
    if (error) throw error;
  },
};

// --- Tasks ---
export const tasksApi = {
  getAll: () => fetchAll<Task>('tasks'),
  add: (data: Omit<Task, 'id'>) => insertOne('tasks', data as unknown as Record<string, unknown>),
  update: (id: number, data: Partial<Task>) => updateOne('tasks', id, data as Record<string, unknown>),
  delete: (id: number) => deleteOne('tasks', id),
  bulkAdd: async (items: Omit<Task, 'id'>[]) => {
    const userId = await getUserId();
    const rows = items.map(item => ({ ...camelToSnake(item as unknown as Record<string, unknown>), user_id: userId }));
    const { data, error } = await supabase.from('tasks').insert(rows).select('id');
    if (error) throw error;
    return data?.map(r => r.id) || [];
  },
  bulkDelete: async (ids: number[]) => {
    const { error } = await supabase.from('tasks').delete().in('id', ids);
    if (error) throw error;
  },
  getByParentId: async (parentId: number): Promise<Task[]> => {
    const { data, error } = await supabase.from('tasks').select('*').eq('parent_id', parentId);
    if (error) throw error;
    return (data || []).map(row => snakeToCamel(row) as unknown as Task);
  },
  countByBlock: async (block: string): Promise<number> => {
    const { count, error } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('block', block);
    if (error) throw error;
    return count || 0;
  },
};

// --- Routines ---
export const routinesApi = {
  getAll: () => fetchAll<Routine>('routines'),
  add: (data: Omit<Routine, 'id'>) => insertOne('routines', data as unknown as Record<string, unknown>),
  update: (id: number, data: Partial<Routine>) => updateOne('routines', id, data as Record<string, unknown>),
  delete: (id: number) => deleteOne('routines', id),
  countByBlock: async (block: string): Promise<number> => {
    const { count, error } = await supabase.from('routines').select('*', { count: 'exact', head: true }).eq('block', block);
    if (error) throw error;
    return count || 0;
  },
};

// --- Routine Completions ---
export const routineCompletionsApi = {
  getAll: () => fetchAll<RoutineCompletion>('routine_completions'),
  add: (data: Omit<RoutineCompletion, 'id'>) => insertOne('routine_completions', data as unknown as Record<string, unknown>),
  delete: (id: number) => deleteOne('routine_completions', id),
  getByRoutineAndDate: async (routineId: number, date: string) => {
    const { data, error } = await supabase
      .from('routine_completions')
      .select('*')
      .eq('routine_id', routineId)
      .eq('date', date)
      .maybeSingle();
    if (error) throw error;
    return data ? snakeToCamel(data) as unknown as RoutineCompletion : null;
  },
};

// --- Reflections ---
export const reflectionsApi = {
  getAll: () => fetchAll<DailyReflection>('reflections'),
  add: (data: Omit<DailyReflection, 'id'>) => insertOne('reflections', data as unknown as Record<string, unknown>),
  update: (id: number, data: Partial<DailyReflection>) => updateOne('reflections', id, data as Record<string, unknown>),
};

// --- User Profile ---
export const userProfileApi = {
  get: async (): Promise<UserProfile | null> => {
    const { data, error } = await supabase.from('user_profiles').select('*').maybeSingle();
    if (error) throw error;
    return data ? snakeToCamel(data) as unknown as UserProfile : null;
  },
  upsert: async (data: Omit<UserProfile, 'id'>) => {
    const userId = await getUserId();
    const snaked = camelToSnake(data as unknown as Record<string, unknown>);
    const { id: _, ...rest } = snaked;
    const { error } = await supabase.from('user_profiles').upsert(
      { ...rest, user_id: userId },
      { onConflict: 'user_id' }
    );
    if (error) throw error;
  },
};

// --- Settings ---
export const settingsApi = {
  get: async (): Promise<Settings | null> => {
    const { data, error } = await supabase.from('user_settings').select('*').maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const converted = snakeToCamel(data) as Record<string, unknown>;
    return {
      id: converted.id as number,
      theme: converted.theme as Settings['theme'],
      soundEnabled: converted.soundEnabled as boolean,
      sortBy: converted.sortBy as Settings['sortBy'],
      viewMode: converted.viewMode as Settings['viewMode'],
      setupCompleted: converted.setupCompleted as boolean,
    };
  },
  upsert: async (data: Omit<Settings, 'id'>) => {
    const userId = await getUserId();
    const snaked = camelToSnake(data as unknown as Record<string, unknown>);
    const { id: _, ...rest } = snaked;
    const { error } = await supabase.from('user_settings').upsert(
      { ...rest, user_id: userId },
      { onConflict: 'user_id' }
    );
    if (error) throw error;
  },
  update: async (updates: Partial<Omit<Settings, 'id'>>) => {
    const userId = await getUserId();
    const snaked = camelToSnake(updates as Record<string, unknown>);
    const { error } = await supabase.from('user_settings').update(snaked).eq('user_id', userId);
    if (error) throw error;
  },
};

// --- Chat Messages ---
export const chatMessagesApi = {
  getAll: async (): Promise<ChatMessage[]> => {
    const { data, error } = await supabase.from('chat_messages').select('*').order('created_at');
    if (error) throw error;
    return (data || []).map(row => snakeToCamel(row) as unknown as ChatMessage);
  },
  add: (data: Omit<ChatMessage, 'id'>) => insertOne('chat_messages', data as unknown as Record<string, unknown>),
  update: (id: number, data: Partial<ChatMessage>) => updateOne('chat_messages', id, data as Record<string, unknown>),
};

// --- Check Lists ---
export const checkListsApi = {
  getAll: () => fetchAll<CheckList>('check_lists'),
  add: (data: Omit<CheckList, 'id'>) => insertOne('check_lists', data as unknown as Record<string, unknown>),
  update: (id: number, data: Partial<CheckList>) => updateOne('check_lists', id, data as Record<string, unknown>),
  delete: (id: number) => deleteOne('check_lists', id),
  count: async (): Promise<number> => {
    const { count, error } = await supabase.from('check_lists').select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  },
};

// --- Check List Items ---
export const checkListItemsApi = {
  getByListId: async (listId: number): Promise<CheckListItem[]> => {
    const { data, error } = await supabase.from('check_list_items').select('*').eq('list_id', listId).order('order');
    if (error) throw error;
    return (data || []).map(row => snakeToCamel(row) as unknown as CheckListItem);
  },
  add: (data: Omit<CheckListItem, 'id'>) => insertOne('check_list_items', data as unknown as Record<string, unknown>),
  update: (id: number, data: Partial<CheckListItem>) => updateOne('check_list_items', id, data as Record<string, unknown>),
  delete: (id: number) => deleteOne('check_list_items', id),
  deleteByListId: (listId: number) => deleteWhere('check_list_items', 'list_id', listId),
};

// --- Purchase History ---
export const purchaseHistoryApi = {
  getByListId: async (listId: number): Promise<PurchaseHistory[]> => {
    const { data, error } = await supabase.from('purchase_history').select('*').eq('list_id', listId);
    if (error) throw error;
    return (data || []).map(row => snakeToCamel(row) as unknown as PurchaseHistory);
  },
  add: (data: Omit<PurchaseHistory, 'id'>) => insertOne('purchase_history', data as unknown as Record<string, unknown>),
  deleteByListId: (listId: number) => deleteWhere('purchase_history', 'list_id', listId),
};
