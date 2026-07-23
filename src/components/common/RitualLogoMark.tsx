export function RitualLogoMark({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border-2 border-ritual-500 bg-void"
      style={{ width: size, height: size }}
    >
      <span
        className="font-display font-bold leading-none text-ritual-500"
        style={{ fontSize: size * 0.5 }}
      >
        r
      </span>
    </div>
  );
}
