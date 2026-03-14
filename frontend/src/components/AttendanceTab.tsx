import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import FileUpload from './FileUpload'
import { Users } from 'lucide-react'

const STATUS_OPTIONS = ['Unknown', 'In-Person', 'Not Attending'] as const

export default function AttendanceTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()

  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ['attendance', projectId],
    queryFn: () => api.getAttendance(projectId),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.updateAttendance(projectId, id, { attendance_status: status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance', projectId] }),
  })

  const counts = {
    'Unknown': attendance.filter((a: any) => a.attendance_status === 'Unknown').length,
    'In-Person': attendance.filter((a: any) => a.attendance_status === 'In-Person').length,
    'Not Attending': attendance.filter((a: any) => a.attendance_status === 'Not Attending').length,
  }

  const statusColor = (s: string) => {
    switch (s) {
      case 'In-Person': return 'bg-green-100 text-green-800'
      case 'Not Attending': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Import Attendance</h2>
        <div className="max-w-md">
          <FileUpload
            label="Attendance CSV (employee_id, email)"
            accept=".csv"
            onUpload={(file) => {
              return api.uploadAttendance(projectId, file).then(res => {
                queryClient.invalidateQueries({ queryKey: ['attendance', projectId] })
                return res
              })
            }}
          />
        </div>
      </div>

      {/* Summary Cards */}
      {attendance.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {(['Unknown', 'In-Person', 'Not Attending'] as const).map(status => (
            <div key={status} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-1">{status}</div>
              <div className="text-2xl font-bold text-gray-900">{counts[status]}</div>
              <div className="text-xs text-gray-400 mt-1">
                {attendance.length > 0 ? `${Math.round(counts[status] / attendance.length * 100)}%` : '0%'} of total
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attendance Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : attendance.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No attendance data yet. Upload a CSV to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Employee ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {attendance.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs">{row.employee_id}</td>
                  <td className="px-4 py-2.5 text-gray-600">{row.email}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={row.attendance_status}
                      onChange={e => updateMut.mutate({ id: row.id, status: e.target.value })}
                      className={`px-2 py-1 rounded-md text-xs font-medium border-0 cursor-pointer ${statusColor(row.attendance_status)}`}
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
