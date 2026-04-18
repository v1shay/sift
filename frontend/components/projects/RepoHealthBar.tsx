type RepoHealthBarProps = {
  health: number;
};

export function RepoHealthBar({ health }: RepoHealthBarProps) {
  return (
    <div className="h-2 rounded-full bg-zinc-100">
      <div className="h-2 rounded-full bg-coral" style={{ width: `${health}%` }} />
    </div>
  );
}

