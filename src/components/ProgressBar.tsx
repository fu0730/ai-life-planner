'use client';

interface ProgressBarProps {
  completed: number;
  total: number;
}

export default function ProgressBar({ completed, total }: ProgressBarProps) {
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  const isComplete = percentage === 100;

  const size = 80;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`bg-white dark:bg-gray-800/60 rounded-2xl px-5 py-4 border transition-all duration-500 ${
      isComplete
        ? 'border-green-200/60 dark:border-green-800/40'
        : 'border-[var(--border)]'
    }`}
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex items-center gap-5">
        {/* 円形リングプログレス */}
        <div className="relative flex-shrink-0">
          <svg width={size} height={size} className="-rotate-90">
            {/* 背景リング */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-gray-100 dark:text-gray-700"
            />
            {/* プログレスリング */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={isComplete ? '#10B981' : 'var(--accent)'}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          {/* 中央の数字 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-sm font-bold ${
              isComplete ? 'text-green-500' : 'text-gray-700 dark:text-gray-200'
            }`}>
              {completed}/{total}
            </span>
          </div>
        </div>

        {/* テキスト */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${
            isComplete ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'
          }`}>
            {isComplete ? '全部完了！' : '今日の進捗'}
          </p>
          <p className={`text-xs mt-0.5 ${
            isComplete ? 'text-green-500/70 dark:text-green-400/70' : 'text-gray-400 dark:text-gray-500'
          }`}>
            {isComplete ? 'よくがんばったね' : `あと${total - completed}つ`}
          </p>
        </div>

        {/* パーセンテージ */}
        <span className={`text-2xl font-bold tracking-tight ${
          isComplete ? 'text-green-500' : 'text-[var(--accent)]'
        }`}>
          {percentage}<span className="text-sm font-medium ml-0.5">%</span>
        </span>
      </div>
    </div>
  );
}
