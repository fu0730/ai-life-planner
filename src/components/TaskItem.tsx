'use client';

import { useState } from 'react';
import type { Task, Category } from '@/types';

interface TaskItemProps {
  task: Task;
  category?: Category;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
}

export default function TaskItem({ task, category, onToggle, onDelete, onEdit }: TaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`bg-white rounded-xl p-4 shadow-sm border transition-all ${
        task.completed ? 'opacity-60' : ''
      }`}
      style={{ borderLeftColor: category?.color || '#ccc', borderLeftWidth: '4px' }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => task.id !== undefined && onToggle(task.id)}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            task.completed
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 hover:border-green-400'
          }`}
        >
          {task.completed && (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <p className={`text-sm font-medium ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.title}
          </p>
          {task.dueDate && !task.completed && (
            <p className="text-xs text-gray-400 mt-1">
              期限: {new Date(task.dueDate).toLocaleDateString('ja-JP')}
            </p>
          )}
        </div>

        {task.priority === 'high' && !task.completed && (
          <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">
            重要
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {task.memo && (
            <p className="text-xs text-gray-500 mb-3">{task.memo}</p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => onEdit(task)}
              className="text-xs text-blue-500 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              編集
            </button>
            <button
              onClick={() => task.id !== undefined && onDelete(task.id)}
              className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              削除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
