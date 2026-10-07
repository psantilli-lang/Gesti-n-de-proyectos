import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
}

export interface MultiSelectDropdownProps {
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  allLabel: string;
  totalCount: number;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  allLabel,
  totalCount,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const selectAll = () => {
    onChange([]);
  };

  const clearAll = () => {
    onChange([]);
  };

  const filteredOptions = useMemo(() => {
    if (!filterSearch.trim()) return options;
    const q = filterSearch.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, filterSearch]);

  const isAllSelected = selectedValues.length === 0;

  // Compute trigger button label
  let triggerText = `${allLabel} (${totalCount})`;
  if (selectedValues.length === 1) {
    const match = options.find((opt) => opt.value === selectedValues[0]);
    triggerText = match ? `${match.label} (${match.count ?? 0})` : selectedValues[0];
  } else if (selectedValues.length > 1) {
    triggerText = `${selectedValues.length} seleccionados`;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
          selectedValues.length > 0
            ? 'bg-blue-50 border-blue-400 text-blue-900 font-semibold shadow-xs'
            : 'bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100'
        }`}
      >
        <span className="truncate max-w-[170px]" title={triggerText}>
          {triggerText}
        </span>
        {selectedValues.length > 1 && (
          <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold">
            {selectedValues.length}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-64 max-h-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 text-xs flex flex-col">
          {/* Header with quick actions */}
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 px-1">
            <span className="font-semibold text-slate-700">{label}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className={`text-[11px] font-medium transition-colors cursor-pointer ${
                  isAllSelected ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-blue-600'
                }`}
              >
                Todos
              </button>
              {selectedValues.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[11px] font-medium text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Search inside dropdown if > 5 options */}
          {options.length > 5 && (
            <div className="px-1 mb-1.5">
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Buscar opción..."
                className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
              />
            </div>
          )}

          {/* Options list */}
          <div className="overflow-y-auto space-y-0.5 flex-1 pr-1 max-h-56">
            {/* "Todas" Option */}
            <label
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 cursor-pointer select-none"
              onClick={selectAll}
            >
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={selectAll}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span className={`flex-1 text-xs ${isAllSelected ? 'font-bold text-blue-900' : 'text-slate-700'}`}>
                {allLabel}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">({totalCount})</span>
            </label>

            <div className="h-px bg-slate-100 my-1" />

            {filteredOptions.map((opt) => {
              const isChecked = selectedValues.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer select-none transition-colors ${
                    isChecked ? 'bg-blue-50/70 font-semibold text-blue-900' : 'text-slate-700'
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleValue(opt.value);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 pointer-events-none"
                  />
                  <span className="flex-1 truncate text-xs" title={opt.label}>
                    {opt.label}
                  </span>
                  {typeof opt.count === 'number' && (
                    <span className="text-[10px] text-slate-400 font-mono">({opt.count})</span>
                  )}
                </label>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="p-3 text-center text-slate-400 text-xs">
                No hay coincidencias
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
