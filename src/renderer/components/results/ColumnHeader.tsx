export type SortField = 'name' | 'path' | 'size' | 'modified' | 'risk';
export type SortDirection = 'asc' | 'desc';

interface ColumnHeaderProps {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDirection: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}

export function ColumnHeader({
  label,
  field,
  currentSort,
  currentDirection,
  onSort,
  className,
}: ColumnHeaderProps) {
  const isActive = currentSort === field;
  const arrow = isActive ? (currentDirection === 'asc' ? '\u25B2' : '\u25BC') : '';

  return (
    <button
      className={`column-header ${isActive ? 'column-header--active' : ''} ${className ?? ''}`}
      onClick={() => onSort(field)}
    >
      <span className="column-header-label">{label}</span>
      {arrow && <span className="column-header-arrow">{arrow}</span>}
    </button>
  );
}
