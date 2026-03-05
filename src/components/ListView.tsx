'use client';

import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { CheckList, CheckListItem, ListType } from '@/types';

interface ListViewProps {
  onEditList: (list: CheckList) => void;
  onDeleteList: (listId: number) => void;
}

const SUB_TABS: { key: ListType; label: string }[] = [
  { key: 'packing', label: '持ち物' },
  { key: 'shopping', label: '買い物' },
];

export default function ListView({ onEditList, onDeleteList }: ListViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<ListType>('packing');
  const [expandedListId, setExpandedListId] = useState<number | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());

  const lists = useLiveQuery(() => db.checkLists.orderBy('order').toArray());
  const allItems = useLiveQuery(() => db.checkListItems.toArray());
  const categories = useLiveQuery(() =>
    db.categories.where('type').equals('checklist').sortBy('order')
  );

  const getProgress = (listId: number) => {
    if (!allItems) return { checked: 0, total: 0 };
    const listItems = allItems.filter(i => i.listId === listId);
    const checked = listItems.filter(i => i.checked).length;
    return { checked, total: listItems.length };
  };

  const getItems = (listId: number) => {
    if (!allItems) return [];
    return allItems.filter(i => i.listId === listId).sort((a, b) => a.order - b.order);
  };

  const toggleCategory = (id: number) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!lists || !categories || !allItems) return null;

  const filteredLists = lists.filter(l => l.type === activeSubTab);

  const getListsForCategory = (categoryId: number) =>
    filteredLists.filter(l => l.categoryId === categoryId);

  const uncategorizedLists = filteredLists.filter(
    l => !l.categoryId || !categories.some(c => c.id === l.categoryId)
  );

  const hasAnyCategorized = filteredLists.some(
    l => l.categoryId && categories.some(c => c.id === l.categoryId)
  );

  const renderListCard = (list: CheckList) => {
    const { checked, total } = getProgress(list.id!);
    const progress = total > 0 ? (checked / total) * 100 : 0;
    const isExpanded = expandedListId === list.id;
    const items = getItems(list.id!);

    return (
      <div
        key={list.id}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all"
      >
        {/* カードヘッダー */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpandedListId(isExpanded ? null : list.id!)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedListId(isExpanded ? null : list.id!); }}
          className="w-full text-left p-4 active:scale-[0.99] transition-transform cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <svg
                className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: list.color }}
              />
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                {list.name}
              </h3>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {checked}/{total}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditList(list);
                }}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                </svg>
              </button>
            </div>
          </div>
          {!isExpanded && total > 0 && (
            <div className="mt-3 ml-7 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, backgroundColor: list.color }}
              />
            </div>
          )}
        </div>

        {/* 展開: アイテム一覧 */}
        {isExpanded && (
          <ListItemsInline
            list={list}
            items={items}
            onDeleteList={onDeleteList}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* サブタブ */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {SUB_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveSubTab(tab.key);
              setExpandedListId(null);
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSubTab === tab.key
                ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {tab.label}
            {lists.filter(l => l.type === tab.key).length > 0 && (
              <span className={`ml-1.5 text-xs ${
                activeSubTab === tab.key ? 'text-gray-400 dark:text-gray-500' : 'text-gray-400 dark:text-gray-600'
              }`}>
                {lists.filter(l => l.type === tab.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* リスト一覧 */}
      {filteredLists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">リストがありません</p>
          <p className="text-xs mt-1">＋ボタンからリストを作成しましょう</p>
        </div>
      ) : !hasAnyCategorized ? (
        <div className="space-y-3">
          {filteredLists.map(renderListCard)}
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map(category => {
            const categoryLists = getListsForCategory(category.id!);
            if (categoryLists.length === 0) return null;
            const isCollapsed = collapsedCategories.has(category.id!);

            return (
              <div key={category.id} className="rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleCategory(category.id!)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{category.name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                    {categoryLists.length}件
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="px-4 py-2 space-y-3">
                    {categoryLists.map(renderListCard)}
                  </div>
                )}
              </div>
            );
          })}

          {uncategorizedLists.length > 0 && (
            <div className="rounded-xl overflow-hidden">
              <button
                onClick={() => toggleCategory(-1)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${collapsedCategories.has(-1) ? '' : 'rotate-90'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="w-3 h-3 rounded-full flex-shrink-0 bg-gray-400" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">その他</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                  {uncategorizedLists.length}件
                </span>
              </button>
              {!collapsedCategories.has(-1) && (
                <div className="px-4 py-2 space-y-3">
                  {uncategorizedLists.map(renderListCard)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- インライン展開コンポーネント ---
function ListItemsInline({
  list,
  items,
  onDeleteList,
}: {
  list: CheckList;
  items: CheckListItem[];
  onDeleteList: (listId: number) => void;
}) {
  const [inlineAddValue, setInlineAddValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const checkedCount = items.filter(i => i.checked).length;

  const handleAddItem = async () => {
    const title = inlineAddValue.trim();
    if (!title) {
      setIsAdding(false);
      return;
    }
    await db.checkListItems.add({
      listId: list.id!,
      title,
      checked: false,
      order: items.length,
      createdAt: new Date().toISOString(),
    });
    setInlineAddValue('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleCheck = async (item: CheckListItem) => {
    if (list.type === 'shopping') {
      await db.purchaseHistory.add({
        listId: list.id!,
        title: item.title,
        purchasedAt: new Date().toISOString(),
      });
      await db.checkListItems.delete(item.id!);
    } else {
      await db.checkListItems.update(item.id!, {
        checked: !item.checked,
        checkedAt: !item.checked ? new Date().toISOString() : undefined,
      });
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    await db.checkListItems.delete(itemId);
  };

  const handleReset = async () => {
    await Promise.all(
      items.map(item =>
        db.checkListItems.update(item.id!, { checked: false, checkedAt: undefined })
      )
    );
  };

  return (
    <div className="border-t border-gray-100 dark:border-gray-700">
      <div className="px-4 py-2 space-y-0.5">
        {items.length === 0 && !isAdding && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">
            アイテムがありません
          </p>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-2 py-2 rounded-lg group"
          >
            <button
              onClick={() => handleCheck(item)}
              className={`w-[18px] h-[18px] rounded-full border-[1.5px] flex-shrink-0 flex items-center justify-center transition-colors ${
                item.checked
                  ? 'border-green-500 bg-green-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              {item.checked && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <span className={`flex-1 text-sm ${
              item.checked
                ? 'text-gray-400 dark:text-gray-500 line-through'
                : 'text-gray-800 dark:text-gray-100'
            }`}>
              {item.title}
            </span>
            <button
              onClick={() => handleDeleteItem(item.id!)}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 transition-opacity"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {/* インライン追加 */}
        {isAdding ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <svg className="w-[18px] h-[18px] text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={inlineAddValue}
              onChange={(e) => setInlineAddValue(e.target.value)}
              onBlur={() => {
                handleAddItem();
                if (!inlineAddValue.trim()) setIsAdding(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddItem();
                }
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setInlineAddValue('');
                }
              }}
              placeholder="アイテム名を入力"
              className="flex-1 text-sm bg-transparent border-b-2 border-blue-400 focus:outline-none text-gray-700 dark:text-gray-200 py-0.5"
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={() => {
              setIsAdding(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="flex items-center gap-3 px-2 py-2 text-xs text-gray-400 dark:text-gray-500 hover:text-[var(--accent)] transition-colors w-full"
          >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            アイテムを追加
          </button>
        )}
      </div>

      {/* リセット / 削除ボタン */}
      {list.type === 'packing' && items.length > 0 && checkedCount > 0 && (
        <div className="px-4 pb-3">
          <button
            onClick={handleReset}
            className="w-full py-2 rounded-lg text-xs font-medium bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            チェックをリセット
          </button>
        </div>
      )}
    </div>
  );
}
