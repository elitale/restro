export function PageHeader({
  title,
  description,
}: {
  readonly title: string;
  readonly description?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {description ? (
        <p className="text-muted-foreground text-sm">{description}</p>
      ) : null}
    </div>
  );
}
