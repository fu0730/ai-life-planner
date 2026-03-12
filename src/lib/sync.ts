import { db } from './db';
import { supabase } from './supabase';
import {
  categoriesApi, tasksApi, routinesApi, routineCompletionsApi,
  reflectionsApi, userProfileApi, settingsApi, chatMessagesApi,
  checkListsApi, checkListItemsApi, purchaseHistoryApi,
} from './supabase-db';

/**
 * ローカル（Dexie）のデータをSupabaseにアップロードする
 * 初回ログイン時に呼び出す
 *
 * IDのマッピングが必要（ローカルIDとサーバーIDは異なる）
 */
export async function migrateLocalToSupabase(): Promise<{ migrated: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { migrated: false, error: 'Not authenticated' };

    // Supabaseに既にデータがあるかチェック（カテゴリで判定）
    const existingCategories = await categoriesApi.getAll();
    if (existingCategories.length > 0) {
      // 既にデータがある → 移行不要
      return { migrated: false };
    }

    // ローカルデータを取得
    const localCategories = await db.categories.toArray();
    if (localCategories.length === 0) {
      // ローカルにもデータがない → 移行不要
      return { migrated: false };
    }

    // ID マッピング用
    const categoryIdMap = new Map<number, number>(); // localId -> serverI
    const taskIdMap = new Map<number, number>();
    const routineIdMap = new Map<number, number>();
    const checkListIdMap = new Map<number, number>();

    // 1. カテゴリ
    for (const cat of localCategories) {
      const { id: localId, ...data } = cat;
      // parentIdは後で更新
      const serverId = await categoriesApi.add({ ...data, parentId: undefined });
      if (localId) categoryIdMap.set(localId, serverId);
    }
    // parentId の更新
    for (const cat of localCategories) {
      if (cat.parentId && cat.id) {
        const serverId = categoryIdMap.get(cat.id);
        const serverParentId = categoryIdMap.get(cat.parentId);
        if (serverId && serverParentId) {
          await categoriesApi.update(serverId, { parentId: serverParentId });
        }
      }
    }

    // 2. タスク（parentIdなし → ありの順）
    const localTasks = await db.tasks.toArray();
    const rootTasks = localTasks.filter(t => !t.parentId);
    const childTasks = localTasks.filter(t => t.parentId);

    for (const task of rootTasks) {
      const { id: localId, categoryId, ...data } = task;
      const serverCategoryId = categoryIdMap.get(categoryId) || categoryId;
      const serverId = await tasksApi.add({ ...data, categoryId: serverCategoryId });
      if (localId) taskIdMap.set(localId, serverId);
    }
    for (const task of childTasks) {
      const { id: localId, categoryId, parentId, ...data } = task;
      const serverCategoryId = categoryIdMap.get(categoryId) || categoryId;
      const serverParentId = parentId ? taskIdMap.get(parentId) : undefined;
      const serverId = await tasksApi.add({ ...data, categoryId: serverCategoryId, parentId: serverParentId });
      if (localId) taskIdMap.set(localId, serverId);
    }

    // 3. ルーティン
    const localRoutines = await db.routines.toArray();
    for (const routine of localRoutines) {
      const { id: localId, ...data } = routine;
      const serverId = await routinesApi.add(data);
      if (localId) routineIdMap.set(localId, serverId);
    }

    // 4. ルーティン完了記録
    const localCompletions = await db.routineCompletions.toArray();
    for (const comp of localCompletions) {
      const { id: _, routineId, ...data } = comp;
      const serverRoutineId = routineIdMap.get(routineId) || routineId;
      await routineCompletionsApi.add({ ...data, routineId: serverRoutineId });
    }

    // 5. 振り返り
    const localReflections = await db.reflections.toArray();
    for (const ref of localReflections) {
      const { id: _, ...data } = ref;
      await reflectionsApi.add(data);
    }

    // 6. ユーザープロフィール
    const localProfile = await db.userProfile.toCollection().first();
    if (localProfile) {
      const { id: _, ...data } = localProfile;
      await userProfileApi.upsert(data);
    }

    // 7. 設定
    const localSettings = await db.settings.toCollection().first();
    if (localSettings) {
      const { id: _, ...data } = localSettings;
      await settingsApi.upsert(data);
    }

    // 8. チャットメッセージ
    const localMessages = await db.chatMessages.toArray();
    for (const msg of localMessages) {
      const { id: _, ...data } = msg;
      await chatMessagesApi.add(data);
    }

    // 9. チェックリスト
    const localCheckLists = await db.checkLists.toArray();
    for (const list of localCheckLists) {
      const { id: localId, categoryId, ...data } = list;
      const serverCategoryId = categoryIdMap.get(categoryId) || categoryId;
      const serverId = await checkListsApi.add({ ...data, categoryId: serverCategoryId });
      if (localId) checkListIdMap.set(localId, serverId);
    }

    // 10. チェックリストアイテム
    const localItems = await db.checkListItems.toArray();
    for (const item of localItems) {
      const { id: _, listId, ...data } = item;
      const serverListId = checkListIdMap.get(listId) || listId;
      await checkListItemsApi.add({ ...data, listId: serverListId });
    }

    // 11. 購入履歴
    const localHistory = await db.purchaseHistory.toArray();
    for (const hist of localHistory) {
      const { id: _, listId, ...data } = hist;
      const serverListId = checkListIdMap.get(listId) || listId;
      await purchaseHistoryApi.add({ ...data, listId: serverListId });
    }

    return { migrated: true };
  } catch (err) {
    console.error('Migration error:', err);
    return { migrated: false, error: String(err) };
  }
}
