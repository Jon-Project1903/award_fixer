import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { ChevronDown, ChevronRight, ExternalLink, User2, ArrowUpDown, ArrowUp, ArrowDown, Search, Pencil, Check, X } from 'lucide-react'

type SortDir = 'asc' | 'desc'

export default function InventorsTab({ projectId }: { projectId: number }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  // Sort state
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Filter state
  const [filters, setFilters] = useState<Record<string, string>>({})
  const setFilter = (key: string, value: string) => setFilters(prev => ({ ...prev, [key]: value }))

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const { data: inventors = [], isLoading } = useQuery({
    queryKey: ['inventors', projectId],
    queryFn: () => api.getInventors(projectId),
  })

  const { data: awardCosts = [] } = useQuery({
    queryKey: ['award-costs', projectId],
    queryFn: () => api.getAwardCosts(projectId),
  })
  const awardTypeOptions = useMemo(() =>
    [...new Set(awardCosts.map((c: any) => c.award_type))].sort() as string[],
    [awardCosts]
  )

  const processed = useMemo(() => {
    let result = inventors

    // Apply filters
    const f = filters
    if (f.legal_name) {
      const q = f.legal_name.toLowerCase()
      result = result.filter((inv: any) =>
        (inv.legal_name || '').toLowerCase().includes(q) ||
        (inv.preferred_name || '').toLowerCase().includes(q)
      )
    }
    if (f.employee_id) {
      const q = f.employee_id.toLowerCase()
      result = result.filter((inv: any) => (inv.employee_id || '').toLowerCase().includes(q))
    }
    if (f.work_email) {
      const q = f.work_email.toLowerCase()
      result = result.filter((inv: any) => (inv.work_email || '').toLowerCase().includes(q))
    }
    if (f.location) {
      const q = f.location.toLowerCase()
      result = result.filter((inv: any) => {
        const loc = [inv.work_city, inv.work_state, inv.work_country_iso].filter(Boolean).join(', ').toLowerCase()
        return loc.includes(q)
      })
    }
    if (f.employment_status) {
      const q = f.employment_status.toLowerCase()
      result = result.filter((inv: any) => (inv.employment_status || '').toLowerCase().includes(q))
    }
    if (f.award_types) {
      const q = f.award_types.toLowerCase()
      result = result.filter((inv: any) => (inv.award_types || []).some((at: string) => at.toLowerCase().includes(q)))
    }

    // Apply sort
    if (sortKey) {
      result = [...result].sort((a: any, b: any) => {
        let av: string, bv: string
        if (sortKey === 'location') {
          av = [a.work_city, a.work_state, a.work_country_iso].filter(Boolean).join(', ').toLowerCase()
          bv = [b.work_city, b.work_state, b.work_country_iso].filter(Boolean).join(', ').toLowerCase()
        } else if (sortKey === 'award_types') {
          av = (a.award_types || []).join(', ').toLowerCase()
          bv = (b.award_types || []).join(', ').toLowerCase()
        } else if (sortKey === 'patent_count') {
          return sortDir === 'asc' ? (a.patent_count - b.patent_count) : (b.patent_count - a.patent_count)
        } else {
          av = (a[sortKey] ?? '').toString().toLowerCase()
          bv = (b[sortKey] ?? '').toString().toLowerCase()
        }
        const cmp = av.localeCompare(bv)
        return sortDir === 'asc' ? cmp : -cmp
      })
    }

    return result
  }, [inventors, sortKey, sortDir, filters])

  const toggleExpand = (key: string) => {
    setExpandedKey(prev => (prev === key ? null : key))
  }

  const dedup = (inv: any) =>
    (inv.employee_id || '').trim() || inv.legal_name.trim().toLowerCase()

  const googlePatentUrl = (patentNo: string) =>
    `https://patents.google.com/patent/${patentNo.replace(/[\s-]/g, '')}`

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>
  }

  if (inventors.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <User2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No inventors found. Import data and run matching first.</p>
      </div>
    )
  }

  const termedCount = inventors.filter((inv: any) =>
    inv.employment_status && inv.employment_status.toLowerCase() === 'termed'
  ).length

  const SortIcon = ({ field }: { field: string }) => {
    if (sortKey !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />
  }

  const columns: { key: string; label: string; filterable?: boolean }[] = [
    { key: 'legal_name', label: 'Name', filterable: true },
    { key: 'employee_id', label: 'Employee ID', filterable: true },
    { key: 'work_email', label: 'Email', filterable: true },
    { key: 'location', label: 'Location', filterable: true },
    { key: 'employment_status', label: 'Status', filterable: true },
    { key: 'award_types', label: 'Award Types', filterable: true },
    { key: 'patent_count', label: 'Patents' },
  ]

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <span className="text-2xl font-bold text-gray-900">{inventors.length}</span>
          <span className="text-sm text-gray-500 ml-2">Total Inventors</span>
        </div>
        {termedCount > 0 && (
          <div className="bg-red-50 rounded-xl border border-red-200 px-4 py-3">
            <span className="text-2xl font-bold text-red-700">{termedCount}</span>
            <span className="text-sm text-red-600 ml-2">Termed</span>
          </div>
        )}
        {processed.length !== inventors.length && (
          <span className="text-xs text-gray-400">Showing {processed.length} of {inventors.length}</span>
        )}
      </div>

      {/* Inventors Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-1">
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-10 px-2 py-3"></th>
              {columns.map(c => (
                <th
                  key={c.key}
                  className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer select-none"
                  onClick={() => toggleSort(c.key)}
                >
                  <span className="inline-flex items-center">{c.label}<SortIcon field={c.key} /></span>
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-2 py-1.5"></th>
              {columns.map(c => (
                <th key={c.key} className="px-4 py-1.5">
                  {c.filterable ? (
                    <div className="relative">
                      <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={filters[c.key] || ''}
                        onChange={e => setFilter(c.key, e.target.value)}
                        placeholder="Filter..."
                        className="w-full pl-7 pr-2 py-1 border border-gray-200 rounded text-xs font-normal focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {processed.map((inv: any) => {
              const key = dedup(inv)
              const isExpanded = expandedKey === key
              return (
                <InventorRow
                  key={key}
                  inv={inv}
                  projectId={projectId}
                  isExpanded={isExpanded}
                  onToggle={() => toggleExpand(key)}
                  onNavigate={(crossrefId: number) => navigate(`/reconciliations/${crossrefId}`)}
                  googlePatentUrl={googlePatentUrl}
                  queryClient={queryClient}
                  awardTypeOptions={awardTypeOptions}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InventorRow({
  inv,
  projectId,
  isExpanded,
  onToggle,
  onNavigate,
  googlePatentUrl,
  queryClient,
  awardTypeOptions,
}: {
  inv: any
  projectId: number
  isExpanded: boolean
  onToggle: () => void
  onNavigate: (crossrefId: number) => void
  googlePatentUrl: (patentNo: string) => string
  queryClient: any
  awardTypeOptions: string[]
}) {
  const location = [inv.work_city, inv.work_state, inv.work_country_iso]
    .filter(Boolean)
    .join(', ')

  const [editingAwardType, setEditingAwardType] = useState(false)
  const [newAwardType, setNewAwardType] = useState('')

  const updateAwardTypeMut = useMutation({
    mutationFn: (awardType: string) =>
      api.updateInventorAwardType(projectId, inv.employee_id || inv.legal_name, awardType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventors', projectId] })
      queryClient.invalidateQueries({ queryKey: ['physical-awards', projectId] })
      queryClient.invalidateQueries({ queryKey: ['award-stats', projectId] })
      setEditingAwardType(false)
    },
  })

  const startEditAwardType = (e: React.MouseEvent) => {
    e.stopPropagation()
    setNewAwardType(inv.award_types[0] || '')
    setEditingAwardType(true)
  }

  return (
    <>
      <tr
        onClick={onToggle}
        className="hover:bg-gray-50 cursor-pointer transition-colors"
      >
        <td className="px-2 py-3 text-center text-gray-400">
          {isExpanded
            ? <ChevronDown className="w-4 h-4 mx-auto" />
            : <ChevronRight className="w-4 h-4 mx-auto" />}
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900">{inv.legal_name}</div>
          {inv.preferred_name && inv.preferred_name !== inv.legal_name && (
            <div className="text-xs text-gray-500">a.k.a. {inv.preferred_name}</div>
          )}
        </td>
        <td className="px-4 py-3 font-mono text-xs text-gray-600">{inv.employee_id || '-'}</td>
        <td className="px-4 py-3 text-gray-600 text-xs">{inv.work_email || '-'}</td>
        <td className="px-4 py-3 text-xs text-gray-600">{location || '-'}</td>
        <td className="px-4 py-3">
          {inv.employment_status ? (
            <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
              inv.employment_status.toLowerCase() === 'termed'
                ? 'bg-red-100 text-red-700'
                : inv.employment_status.toLowerCase() === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
            }`}>
              {inv.employment_status}
            </span>
          ) : (
            <span className="text-gray-300 text-xs">-</span>
          )}
        </td>
        <td className="px-4 py-3">
          {editingAwardType ? (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <select
                value={newAwardType}
                onChange={e => setNewAwardType(e.target.value)}
                className="px-2 py-0.5 border border-blue-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                autoFocus
              >
                <option value="">-- Select --</option>
                {awardTypeOptions.map(at => (
                  <option key={at} value={at}>{at}</option>
                ))}
                <option value="Opt-Out">Opt-Out</option>
              </select>
              <button onClick={() => { if (newAwardType) updateAwardTypeMut.mutate(newAwardType) }} className="p-0.5 text-green-600 hover:bg-green-50 rounded cursor-pointer border-0 bg-transparent"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditingAwardType(false)} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded cursor-pointer border-0 bg-transparent"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1 group">
              <div className="flex flex-wrap gap-1">
                {inv.award_types.map((at: string) => (
                  <span
                    key={at}
                    className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                      at.toLowerCase() === 'opt-out'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {at}
                  </span>
                ))}
              </div>
              <button
                onClick={startEditAwardType}
                className="p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer border-0 bg-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                title="Edit award type"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
            {inv.patent_count}
          </span>
        </td>
      </tr>

      {/* Expanded Detail */}
      {isExpanded && (
        <tr>
          <td colSpan={8} className="px-0 py-0">
            <div className="bg-gray-50 border-t border-b border-gray-200">
              <div className="px-8 py-4 grid grid-cols-4 gap-4 text-xs border-b border-gray-200">
                <DetailField label="Employee ID" value={inv.employee_id} />
                <DetailField label="Email" value={inv.work_email} />
                <DetailField label="Employment Status" value={inv.employment_status} badgeClass={
                  inv.employment_status === 'Active' ? 'text-green-700 bg-green-50'
                  : inv.employment_status ? 'text-gray-600 bg-gray-100' : ''
                } />
                <DetailField label="Address" value={inv.address} />
                <DetailField label="City" value={inv.work_city} />
                <DetailField label="State" value={inv.work_state} />
                <DetailField label="Country ISO" value={inv.work_country_iso} />
                <DetailField label="Office Country" value={inv.office_location_country} />
              </div>

              <div className="px-8 py-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Patents ({inv.patents.length})
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="text-left py-1.5 pr-4 font-medium">Patent No.</th>
                      <th className="text-left py-1.5 pr-4 font-medium">Asset Name</th>
                      <th className="text-left py-1.5 pr-4 font-medium">Title</th>
                      <th className="text-left py-1.5 pr-4 font-medium">Issue Date</th>
                      <th className="text-left py-1.5 pr-4 font-medium">Award Type</th>
                      <th className="py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {inv.patents.map((p: any, i: number) => (
                      <tr key={i} className="text-gray-700">
                        <td className="py-1.5 pr-4 font-mono">
                          <a
                            href={googlePatentUrl(p.patent_no)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 no-underline inline-flex items-center gap-1"
                            onClick={e => e.stopPropagation()}
                          >
                            {p.patent_no}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="py-1.5 pr-4">{p.asset_name}</td>
                        <td className="py-1.5 pr-4 max-w-xs truncate">{p.title}</td>
                        <td className="py-1.5 pr-4">{p.issue_date || '-'}</td>
                        <td className="py-1.5 pr-4">
                          <span className={`px-2 py-0.5 rounded-full ${
                            p.award_type?.toLowerCase() === 'opt-out'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {p.award_type || '-'}
                          </span>
                        </td>
                        <td className="py-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); onNavigate(p.crossref_id) }}
                            className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer border-0 bg-transparent underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function DetailField({ label, value, badgeClass }: { label: string; value?: string | null; badgeClass?: string }) {
  return (
    <div>
      <div className="text-gray-500 mb-0.5">{label}</div>
      {value ? (
        badgeClass
          ? <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}>{value}</span>
          : <div className="text-gray-900 font-medium">{value}</div>
      ) : (
        <div className="text-gray-300">-</div>
      )}
    </div>
  )
}
