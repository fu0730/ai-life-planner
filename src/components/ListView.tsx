'use client';

import { useState, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CheckList, CheckListItem, ListType } from '@/types';

interface ListViewProps {
  onEditList: (list: CheckList) => void;
  onDeleteList: (listId: number) => void;
}

const SUB_TABS: { key: ListType; label: string }[] = [
  { key: 'packing', label: '持ち物' },
  { key: 'shopping', label: '買い物' },
];

// --- ドラッグハンドル ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DragHandle({ listeners, attributes }: { listeners?: any; attributes?: any }) {
  return (
    <button
      className="touch-none p-1 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0"
      {...listeners}
      {...attributes}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="9" cy="6" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" />
        <circle cx="15" cy="18" r="1.5" />
      </svg>
    </button>
  );
}

// --- ソート可能リストカード ---
function SortableListCard({
  list,
  isExpanded,
  onToggleExpand,
  onEditList,
  onDeleteList,
  items,
  progress,
  checked,
  total,
}: {
  list: CheckList;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEditList: (list: CheckList) => void;
  onDeleteList: (listId: number) => void;
  items: CheckListItem[];
  progress: number;
  checked: number;
  total: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id!,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all"
    >
      {/* カードヘッダー */}
      <div className="w-full text-left p-4 active:scale-[0.99] transition-transform">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <DragHandle listeners={listeners} attributes={attributes} />
            <div
              role="button"
              tabIndex={0}
              onClick={onToggleExpand}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggleExpand(); }}
              className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
            >
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
          <div
            role="button"
            tabIndex={0}
            onClick={onToggleExpand}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggleExpand(); }}
            className="mt-3 ml-10 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden cursor-pointer"
          >
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
}

export default function ListView({ onEditList, onDeleteList }: ListViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<ListType>('packing');
  const [expandedListId, setExpandedListId] = useState<number | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

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

  const handleListDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !lists) return;

    const filtered = lists.filter(l => l.type === activeSubTab);
    const oldIndex = filtered.findIndex(l => l.id === active.id);
    const newIndex = filtered.findIndex(l => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(filtered, oldIndex, newIndex);
    await Promise.all(
      reordered.map((list, i) => db.checkLists.update(list.id!, { order: i }))
    );
  }, [lists, activeSubTab]);

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

  const renderSortableLists = (listsToRender: CheckList[]) => (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleListDragEnd}>
      <SortableContext items={listsToRender.map(l => l.id!)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {listsToRender.map(list => {
            const { checked, total } = getProgress(list.id!);
            const progress = total > 0 ? (checked / total) * 100 : 0;
            return (
              <SortableListCard
                key={list.id}
                list={list}
                isExpanded={expandedListId === list.id}
                onToggleExpand={() => setExpandedListId(expandedListId === list.id ? null : list.id!)}
                onEditList={onEditList}
                onDeleteList={onDeleteList}
                items={getItems(list.id!)}
                progress={progress}
                checked={checked}
                total={total}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );

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
        renderSortableLists(filteredLists)
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
                  <div className="px-4 py-2">
                    {renderSortableLists(categoryLists)}
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
                <div className="px-4 py-2">
                  {renderSortableLists(uncategorizedLists)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- ソート可能アイテム行 ---
function SortableItem({
  item,
  listType,
  onCheck,
  onDelete,
  editingId,
  editValue,
  onStartEdit,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
}: {
  item: CheckListItem;
  listType: ListType;
  onCheck: (item: CheckListItem) => void;
  onDelete: (id: number) => void;
  editingId: number | null;
  editValue: string;
  onStartEdit: (item: CheckListItem) => void;
  onEditChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id!,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const isEditing = editingId === item.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-2 rounded-lg group"
    >
      <DragHandle listeners={listeners} attributes={attributes} />
      <button
        onClick={() => onCheck(item)}
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
      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onSaveEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSaveEdit();
            if (e.key === 'Escape') onCancelEdit();
          }}
          className="flex-1 text-sm bg-transparent border-b-2 border-blue-400 focus:outline-none text-gray-700 dark:text-gray-200 py-0.5"
          autoFocus
        />
      ) : (
        <span
          onClick={() => onStartEdit(item)}
          className={`flex-1 text-sm cursor-pointer ${
            item.checked
              ? 'text-gray-400 dark:text-gray-500 line-through'
              : 'text-gray-800 dark:text-gray-100'
          }`}
        >
          {item.title}
        </span>
      )}
      <button
        onClick={() => onDelete(item.id!)}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 transition-opacity"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

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

  const handleStartEdit = (item: CheckListItem) => {
    setEditingId(item.id!);
    setEditValue(item.title);
  };

  const handleSaveEdit = async () => {
    if (editingId !== null) {
      const trimmed = editValue.trim();
      if (trimmed) {
        await db.checkListItems.update(editingId, { title: trimmed });
      }
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleItemDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    await Promise.all(
      reordered.map((item, i) => db.checkListItems.update(item.id!, { order: i }))
    );
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

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
          <SortableContext items={items.map(i => i.id!)} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                listType={list.type}
                onCheck={handleCheck}
                onDelete={handleDeleteItem}
                editingId={editingId}
                editValue={editValue}
                onStartEdit={handleStartEdit}
                onEditChange={setEditValue}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
              />
            ))}
          </SortableContext>
        </DndContext>

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
