export function EmptyState({
  title,
  description,
}: {
  readonly title: string;
  readonly description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-12 text-center">
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground text-sm">{description}</p>
      ) : null}
    </div>
  );
}
