export default function TagList({ tags = [], emptyText = 'No tags' }) {
  if (!tags.length) {
    return <span className="text-xs text-slate-400">{emptyText}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag.id ?? tag.name}
          className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700"
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}

