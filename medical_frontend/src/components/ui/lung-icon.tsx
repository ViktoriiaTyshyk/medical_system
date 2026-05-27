export function LungIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      {/* trachea */}
      <path d="M12 2v4" />
      {/* bronchi */}
      <path d="M12 6L9.5 7.5M12 6L14.5 7.5" />
      {/* left lung */}
      <path d="M9.5 7.5C7 8.5 4.5 11.5 4.5 15C4.5 18 6.5 20.5 9 21C10.5 21.5 12 20.5 12 19.5L12 7.5Z" />
      {/* right lung */}
      <path d="M14.5 7.5C17 8.5 19.5 11.5 19.5 15C19.5 18 17.5 20.5 15 21C13.5 21.5 12 20.5 12 19.5L12 7.5Z" />
    </svg>
  )
}
