export function RitualLogoMark({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl bg-white shadow-glow-sm"
      style={{ width: size, height: size }}
    >
      <span
        className="font-display font-bold leading-none text-ritual-600"
        style={{ fontSize: size * 0.56 }}
      >
        r
      </span>
    </div>
  );
}
