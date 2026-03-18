import { useState, useMemo } from 'react'

type SortDir = 'asc' | 'desc'

export interface ColumnDef {
  key: string
  label: string
  sortable?: boolean
  filterable?: boolean
}

export function useSortFilter<T extends Record<string, any>>(
  rows: T[],
  columns: ColumnDef[],
) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filters, setFilters] = useState<Record<string, string>>({})

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const setFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const processed = useMemo(() => {
    let result = rows

    // Apply filters
    for (const col of columns) {
      if (col.filterable && filters[col.key]) {
        const q = filters[col.key].toLowerCase()
        result = result.filter(r => {
          const val = (r[col.key] ?? '').toString().toLowerCase()
          return val.includes(q)
        })
      }
    }

    // Apply sort
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = (a[sortKey] ?? '').toString().toLowerCase()
        const bv = (b[sortKey] ?? '').toString().toLowerCase()
        const cmp = av.localeCompare(bv)
        return sortDir === 'asc' ? cmp : -cmp
      })
    }

    return result
  }, [rows, columns, sortKey, sortDir, filters])

  return { processed, sortKey, sortDir, toggleSort, filters, setFilter }
}
