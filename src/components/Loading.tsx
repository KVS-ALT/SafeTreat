export default function Loading({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="space-y-4 py-6" aria-busy="true" aria-label={text}>
      <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-2" />
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="h-80 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-80 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    </div>
  );
}
