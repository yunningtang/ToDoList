interface Props {
  text?: string
  kind?: 'none' | 'search' | 'tasks' | 'focus' | 'countdown'
  size?: number
}

/** 空状态：文字或带插画 */
export default function EmptyState({ text = '没有任务', kind = 'none', size = 220 }: Props) {
  return (
    <div className="empty">
      {kind === 'search' && <SearchIllustration size={size} />}
      {kind === 'tasks' && <TasksIllustration size={size} />}
      {kind === 'focus' && <FocusIllustration size={size} />}
      {kind === 'countdown' && <CountdownIllustration size={size} />}
      <div>{text}</div>
    </div>
  )
}

function SearchIllustration({ size }: { size: number }) {
  return (
    <svg className="ill" width={size} height={size} viewBox="0 0 240 240" fill="none">
      <path d="M48 150c-18-30 4-80 48-96s96-4 110 36-10 86-52 96-88-6-106-36Z" fill="#eef1f8" />
      <path d="M78 118c6-26 18-40 40-46 10-3 16 0 20 8" stroke="#1f2a44" strokeWidth="3" strokeLinecap="round" />
      <circle cx="98" cy="116" r="22" fill="#fff" stroke="#1f2a44" strokeWidth="4" />
      <circle cx="98" cy="116" r="12" fill="#1f2a44" />
      <circle cx="142" cy="116" r="22" fill="#fff" stroke="#1f2a44" strokeWidth="4" />
      <circle cx="142" cy="116" r="12" fill="#4772fa" />
      <rect x="108" y="98" width="24" height="18" rx="4" fill="#dfe6fb" stroke="#1f2a44" strokeWidth="3" />
      <path d="M70 128c-10 8-16 10-20 22 4 10 10 14 26 10" fill="#fff" stroke="#1f2a44" strokeWidth="3" strokeLinecap="round" />
      <path d="M166 124c12 2 22 8 22 20-4 12-10 14-22 10" fill="#fff" stroke="#1f2a44" strokeWidth="3" strokeLinecap="round" />
      <path d="M62 148c-6 8-6 16 0 20M182 146c6 8 6 16 0 20" stroke="#4772fa" strokeWidth="5" strokeLinecap="round" />
      <path d="M120 140c0 24-6 34 0 50" stroke="#1f2a44" strokeWidth="2" strokeDasharray="4 4" />
      <path d="M58 64l4 8 8 4-8 4-4 8-4-8-8-4 8-4Z" fill="#1f2a44" />
      <path d="M190 68l3 6 6 3-6 3-3 6-3-6-6-3 6-3Z" fill="#1f2a44" />
      <circle cx="162" cy="48" r="3" stroke="#1f2a44" strokeWidth="2" />
    </svg>
  )
}

function TasksIllustration({ size }: { size: number }) {
  return (
    <svg className="ill" width={size} height={size} viewBox="0 0 240 240" fill="none">
      <ellipse cx="120" cy="190" rx="86" ry="14" fill="#eef1f8" />
      <rect x="70" y="52" width="100" height="128" rx="12" fill="#fff" stroke="#dfe3ee" strokeWidth="3" />
      <rect x="96" y="40" width="48" height="22" rx="8" fill="#4772fa" />
      <rect x="86" y="84" width="14" height="14" rx="4" fill="#4772fa" />
      <rect x="108" y="86" width="44" height="10" rx="5" fill="#e3e8f5" />
      <rect x="86" y="112" width="14" height="14" rx="4" stroke="#c9d0e0" strokeWidth="3" />
      <rect x="108" y="114" width="52" height="10" rx="5" fill="#e3e8f5" />
      <rect x="86" y="140" width="14" height="14" rx="4" stroke="#c9d0e0" strokeWidth="3" />
      <rect x="108" y="142" width="36" height="10" rx="5" fill="#e3e8f5" />
      <path d="M89 91l3 3 6-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function FocusIllustration({ size }: { size: number }) {
  return (
    <svg className="ill" width={size} height={size} viewBox="0 0 240 240" fill="none">
      <circle cx="120" cy="124" r="70" fill="#eef1f8" />
      <circle cx="120" cy="124" r="52" fill="#fff" stroke="#dfe3ee" strokeWidth="3" />
      <path d="M120 124V86M120 124l24 18" stroke="#4772fa" strokeWidth="6" strokeLinecap="round" />
      <path d="M110 50c6-10 20-10 26 0" stroke="#2dca8c" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

function CountdownIllustration({ size }: { size: number }) {
  return (
    <svg className="ill" width={size} height={size} viewBox="0 0 240 240" fill="none">
      <rect x="56" y="64" width="128" height="116" rx="16" fill="#fff" stroke="#dfe3ee" strokeWidth="3" />
      <rect x="56" y="64" width="128" height="30" rx="14" fill="#4772fa" />
      <rect x="84" y="50" width="10" height="26" rx="5" fill="#1f2a44" />
      <rect x="146" y="50" width="10" height="26" rx="5" fill="#1f2a44" />
      <text x="120" y="150" textAnchor="middle" fontSize="40" fontWeight="700" fill="#4772fa">
        7
      </text>
    </svg>
  )
}
