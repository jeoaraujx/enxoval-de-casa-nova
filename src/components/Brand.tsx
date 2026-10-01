export function Brand({
  light = false,
  compact = false,
  stacked = false,
}: {
  light?: boolean;
  compact?: boolean;
  stacked?: boolean;
}) {
  return (
    <span
      className={`brand ${light ? "brand-light" : ""} ${stacked ? "brand-stacked" : ""}`}
      role="img"
      aria-label="Larume — seu lar começa aqui"
    >
      <img
        src={
          light
            ? "/brand/larume-symbol-white.webp"
            : "/brand/larume-symbol.webp"
        }
        width="512"
        height="512"
        alt=""
        aria-hidden="true"
        className="brand-symbol"
      />
      {!compact && <span className="brand-word">Larume</span>}
    </span>
  );
}
