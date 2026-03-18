import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import DataInputTab from '../components/DataInputTab'
import ReconciliationTab from '../components/ReconciliationTab'
import InventorsTab from '../components/InventorsTab'
import AwardsTab from '../components/AwardsTab'
import AttendanceTab from '../components/AttendanceTab'
import ShippingTab from '../components/ShippingTab'
import CostsTab from '../components/CostsTab'
import ReportTab from '../components/ReportTab'
import { Database, GitCompare, User2, Award, Users, Package, DollarSign, FileSpreadsheet } from 'lucide-react'

const TABS = [
  { key: 'data', label: 'Data Input', icon: Database },
  { key: 'reconciliation', label: 'Reconciliation', icon: GitCompare },
  { key: 'inventors', label: 'Inventors', icon: User2 },
  { key: 'awards', label: 'Awards', icon: Award },
  { key: 'attendance', label: 'Attendance', icon: Users },
  { key: 'shipping', label: 'Shipping', icon: Package },
  { key: 'costs', label: 'Costs', icon: DollarSign },
  { key: 'report', label: 'Report', icon: FileSpreadsheet },
] as const

type TabKey = typeof TABS[number]['key']

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const projectId = Number(id)
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = (searchParams.get('tab') as TabKey) || 'data'

  const setTab = (tab: TabKey) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      // Clear reconciliation-specific params when switching away
      if (tab !== 'reconciliation') {
        next.delete('status')
        next.delete('sort')
        next.delete('dir')
      }
      return next
    }, { replace: true })
  }

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId),
  })

  return (
    <div>
      {/* Project Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 m-0">{project?.name || 'Loading...'}</h1>
        {project && (
          <p className="text-sm text-gray-500 mt-1">
            Created {new Date(project.created_at).toLocaleDateString()}
            {project.total > 0 && (
              <span className="ml-3">
                {project.total} records | {project.passed} passed | {project.flagged} flagged | {project.resolved} resolved
              </span>
            )}
          </p>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer bg-transparent border-x-0 border-t-0
                ${isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'data' && <DataInputTab projectId={projectId} />}
      {activeTab === 'reconciliation' && <ReconciliationTab projectId={projectId} />}
      {activeTab === 'inventors' && <InventorsTab projectId={projectId} />}
      {activeTab === 'awards' && <AwardsTab projectId={projectId} />}
      {activeTab === 'attendance' && <AttendanceTab projectId={projectId} />}
      {activeTab === 'shipping' && <ShippingTab projectId={projectId} />}
      {activeTab === 'costs' && <CostsTab projectId={projectId} />}
      {activeTab === 'report' && <ReportTab projectId={projectId} />}
    </div>
  )
}
