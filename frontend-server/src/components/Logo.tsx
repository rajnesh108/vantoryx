export function Logo({ className = "logo" }: { className?: string }) {
  const id = className.replace(/\s+/g, "-");
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-mark`} x1="4" y1="2" x2="46" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3ad4d4" />
          <stop offset="46%" stopColor="#0e8f96" />
          <stop offset="100%" stopColor="#0a4d62" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="8" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${id}-mark)`} />
      <path d="M2 16c8-10 16-12 22-8 4 3 8 2 14-4v16C30 14 24 18 16 22 10 25 6 22 2 16Z" fill={`url(#${id}-shine)`} />
      <path
        d="M8.5 25.5h5.4l2.5-7 4 14 3.4-9.2 2.3 2.2H39"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="logo-node" cx="37" cy="13" r="3.1" fill="#d9fffb" />
      <circle cx="37" cy="13" r="1.25" fill="#083f50" />
    </svg>
  );
}
