interface MiniDonutProps {
  completed: number;
  total: number;
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
}

export default function MiniDonut({ completed, total, size = 14, onClick }: MiniDonutProps) {
  if (total === 0) return null;
  const ratio = completed / total;
  const allDone = completed === total;
  const r = 5;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - ratio);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      className={`flex-shrink-0 ${onClick && completed > 0 ? 'cursor-pointer active:scale-90 transition-transform' : ''}`}
      onClick={onClick && completed > 0 ? onClick : undefined}
    >
      {/* 背景リング */}
      <circle
        cx="7" cy="7" r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="text-gray-200 dark:text-gray-600"
      />
      {/* 進捗リング */}
      <circle
        cx="7" cy="7" r={r}
        fill="none"
        stroke={allDone ? '#22c55e' : '#60a5fa'}
        strokeWidth="2.5"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 7 7)"
        className="transition-all duration-300"
      />
      {allDone && (
        <path
          d="M4.5 7.2L6.2 8.8L9.5 5.5"
          fill="none"
          stroke="#22c55e"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
