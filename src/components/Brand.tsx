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
      aria-label="Larumi — seu lar começa aqui"
    >
      <img
        src={
          light
            ? "/brand/larumi-symbol-white.webp"
            : "/brand/larumi-symbol.webp"
        }
        width="512"
        height="512"
        alt=""
        aria-hidden="true"
        className="brand-symbol"
      />
      {!compact && <span className="brand-word">Larumi</span>}
    </span>
  );
}
