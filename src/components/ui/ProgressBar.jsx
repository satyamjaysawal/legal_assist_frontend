export function ProgressBar({ pct, tone }) {
  const fill = tone === "error"
    ? "bg-gradient-to-r from-red-500 to-rose-500"
    : "bg-gradient-to-r from-emerald-500 to-teal-500";

  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
      <span className={`block h-full rounded-full transition-all duration-300 ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
