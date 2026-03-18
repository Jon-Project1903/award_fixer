import { ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react'
import type { ColumnDef } from '../hooks/useSortFilter'

interface Props {
  columns: ColumnDef[]
  sortKey: string | null
  sortDir: 'asc' | 'desc'
  toggleSort: (key: string) => void
  filters: Record<string, string>
  setFilter: (key: string, value: string) => void
  headerClass?: string
  extraTh?: React.ReactNode
}

export default function SortFilterHeader({
  columns, sortKey, sortDir, toggleSort, filters, setFilter, headerClass = 'bg-gray-50', extraTh,
}: Props) {
  const hasFilters = columns.some(c => c.filterable)

  return (
    <thead className="sticky top-0 z-1">
      <tr className={`${headerClass} border-b border-gray-200`}>
        {columns.map(c => (
          <th
            key={c.key}
            className={`text-left px-4 py-2.5 font-medium text-gray-600 ${c.sortable ? 'cursor-pointer select-none' : ''}`}
            onClick={c.sortable ? () => toggleSort(c.key) : undefined}
          >
            <span className="inline-flex items-center">
              {c.label}
              {c.sortable && (
                sortKey === c.key
                  ? sortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />
                  : <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />
              )}
            </span>
          </th>
        ))}
        {extraTh}
      </tr>
      {hasFilters && (
        <tr className={`${headerClass} border-b border-gray-200`}>
          {columns.map(c => (
            <th key={c.key} className="px-4 py-1.5">
              {c.filterable ? (
                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={filters[c.key] || ''}
                    onChange={e => setFilter(c.key, e.target.value)}
                    placeholder={`Filter...`}
                    className="w-full pl-7 pr-2 py-1 border border-gray-200 rounded text-xs font-normal focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              ) : null}
            </th>
          ))}
          {extraTh && <th className="px-2 py-1.5"></th>}
        </tr>
      )}
    </thead>
  )
}
