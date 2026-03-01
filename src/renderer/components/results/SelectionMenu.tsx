import { useState, useRef, useEffect } from 'react';
import type { SmartSelectMode } from '../../hooks/useSelection';

interface SelectionMenuProps {
  onSelect: (mode: SmartSelectMode) => void;
  hasDuplicateGroups: boolean;
  selectedCount: number;
  totalCount: number;
}

interface MenuOption {
  mode: SmartSelectMode;
  label: string;
  description: string;
  duplicatesOnly?: boolean;
}

const MENU_OPTIONS: MenuOption[] = [
  { mode: 'all', label: 'Select All', description: 'Select every item' },
  { mode: 'none', label: 'Select None', description: 'Clear selection' },
  {
    mode: 'all-except-newest',
    label: 'All Except Newest',
    description: 'Keep newest copy in each group',
    duplicatesOnly: true,
  },
  {
    mode: 'all-except-oldest',
    label: 'All Except Oldest',
    description: 'Keep oldest copy in each group',
    duplicatesOnly: true,
  },
  {
    mode: 'all-except-biggest',
    label: 'All Except Biggest',
    description: 'Keep largest copy in each group',
    duplicatesOnly: true,
  },
  {
    mode: 'all-except-smallest',
    label: 'All Except Smallest',
    description: 'Keep smallest copy in each group',
    duplicatesOnly: true,
  },
];

export function SelectionMenu({
  onSelect,
  hasDuplicateGroups,
  selectedCount,
  totalCount,
}: SelectionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const visibleOptions = MENU_OPTIONS.filter((opt) => !opt.duplicatesOnly || hasDuplicateGroups);

  return (
    <div className="selection-menu" ref={menuRef}>
      <button className="selection-menu-trigger" onClick={() => setOpen(!open)}>
        <span className="selection-menu-count">
          {selectedCount}/{totalCount}
        </span>
        <span className="selection-menu-caret">{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open && (
        <div className="selection-menu-dropdown">
          {visibleOptions.map((opt) => (
            <button
              key={opt.mode}
              className="selection-menu-option"
              onClick={() => {
                onSelect(opt.mode);
                setOpen(false);
              }}
            >
              <span className="selection-menu-option-label">{opt.label}</span>
              <span className="selection-menu-option-desc">{opt.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
