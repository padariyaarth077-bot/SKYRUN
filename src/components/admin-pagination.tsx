export function AdminPagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / 50));
  return (
    <nav
      aria-label="Results pagination"
      className="flex items-center justify-end gap-3 p-3 text-sm"
    >
      <span>
        {total} results · Page {page + 1} of {pages}
      </span>
      <button
        className="rounded border px-3 py-1 disabled:opacity-40"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <button
        className="rounded border px-3 py-1 disabled:opacity-40"
        disabled={page + 1 >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
