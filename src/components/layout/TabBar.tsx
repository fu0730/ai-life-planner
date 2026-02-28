'use client';

type Tab = 'today' | 'tasks' | 'calendar';

interface TabBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'today', label: '今日', icon: '☀️' },
    { id: 'tasks', label: 'タスク', icon: '📋' },
    { id: 'calendar', label: 'カレンダー', icon: '📅' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 safe-area-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
              activeTab === tab.id
                ? 'text-blue-500'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-xs mt-1 font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
