export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="We Saw"
      className="shrink-0 rounded-[22%]"
    >
      <defs>
        <linearGradient id="wesaw-mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1c2130" />
          <stop offset="1" stopColor="#0a0b0f" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#wesaw-mark-bg)" />
      <circle cx="174" cy="264" r="80" fill="#f6efdd" />
      <circle cx="338" cy="264" r="80" fill="#f6efdd" />
      <circle cx="184" cy="258" r="37" fill="#e8b64c" />
      <circle cx="328" cy="258" r="37" fill="#e0685c" />
      <circle cx="184" cy="258" r="17" fill="#14161c" />
      <circle cx="328" cy="258" r="17" fill="#14161c" />
      <circle cx="190" cy="251" r="6" fill="#f6efdd" />
      <circle cx="334" cy="251" r="6" fill="#f6efdd" />
    </svg>
  );
}

export function LogoLockup({ size = 44 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={size} />
      <span className="text-[30px] font-bold tracking-tight">
        We <span className="text-accent">Saw</span>
      </span>
    </div>
  );
}
