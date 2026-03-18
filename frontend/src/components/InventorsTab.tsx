import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { ChevronDown, ChevronRight, ExternalLink, User2 } from 'lucide-react'

export default function InventorsTab({ projectId }: { projectId: number }) {
  const navigate = useNavigate()
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { data: inventors = [], isLoading } = useQuery({
    queryKey: ['inventors', projectId],
    queryFn: () => api.getInventors(projectId),
  })

  const filtered = search.trim()
    ? inventors.filter((inv: any) => {
        const q = search.toLowerCase()
        return (
          (inv.legal_name || '').toLowerCase().includes(q) ||
          (inv.preferred_name || '').toLowerCase().includes(q) ||
          (inv.employee_id || '').toLowerCase().includes(q) ||
          (inv.work_email || '').toLowerCase().includes(q)
        )
      })
    : inventors

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
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, ID, or email..."
          className="w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <span className="text-sm text-gray-500">
          {filtered.length} inventor{filtered.length !== 1 ? 's' : ''}
          {search && ` matching "${search}"`}
        </span>
      </div>

      {/* Inventors Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-10 px-2 py-3"></th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Employee ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Award Types</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Patents</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((inv: any) => {
              const key = dedup(inv)
              const isExpanded = expandedKey === key
              return (
                <InventorRow
                  key={key}
                  inv={inv}
                  isExpanded={isExpanded}
                  onToggle={() => toggleExpand(key)}
                  onNavigate={(crossrefId: number) => navigate(`/reconciliations/${crossrefId}`)}
                  googlePatentUrl={googlePatentUrl}
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
  isExpanded,
  onToggle,
  onNavigate,
  googlePatentUrl,
}: {
  inv: any
  isExpanded: boolean
  onToggle: () => void
  onNavigate: (crossrefId: number) => void
  googlePatentUrl: (patentNo: string) => string
}) {
  const location = [inv.work_city, inv.work_state, inv.work_country_iso]
    .filter(Boolean)
    .join(', ')

  const statusColor = inv.employment_status === 'Active'
    ? 'text-green-700 bg-green-50'
    : inv.employment_status
      ? 'text-gray-600 bg-gray-100'
      : ''

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
              {/* Inventor detail fields */}
              <div className="px-8 py-4 grid grid-cols-4 gap-4 text-xs border-b border-gray-200">
                <DetailField label="Employee ID" value={inv.employee_id} />
                <DetailField label="Email" value={inv.work_email} />
                <DetailField label="Employment Status" value={inv.employment_status} badgeClass={statusColor} />
                <DetailField label="Address" value={inv.address} />
                <DetailField label="City" value={inv.work_city} />
                <DetailField label="State" value={inv.work_state} />
                <DetailField label="Country ISO" value={inv.work_country_iso} />
                <DetailField label="Office Country" value={inv.office_location_country} />
              </div>

              {/* Patent list */}
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
