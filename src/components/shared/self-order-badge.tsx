/** LOUD pill marking a guest self-order (distinct from staff-placed tickets). */
export function SelfOrderBadge({ className }: { readonly className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold tracking-wide text-violet-900 uppercase ring-1 ring-violet-300${className ? ` ${className}` : ""}`}
    >
      Self-order
    </span>
  );
}
