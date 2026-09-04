export function Progress({ label, value }: { label: string; value: number }) {
  const normalizedValue = Math.min(100, Math.max(0, value))

  return (
    <div>
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={normalizedValue}
        className="dw-progress"
        role="progressbar"
      >
        <span style={{ width: `${normalizedValue}%` }} />
      </div>
      <span className="dw-label mt-2 block">{label}</span>
    </div>
  )
}
