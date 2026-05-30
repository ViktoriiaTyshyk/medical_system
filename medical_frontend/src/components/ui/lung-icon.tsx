export function LungIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/lung-white.png"
      width={size}
      height={size}
      alt="lungs"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  )
}
