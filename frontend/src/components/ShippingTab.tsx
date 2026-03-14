import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import FileUpload from './FileUpload'
import { Package, ChevronDown, ChevronRight, Trash2, AlertTriangle, MapPin } from 'lucide-react'

export default function ShippingTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()
  const [expandedAddr, setExpandedAddr] = useState<number | null>(null)

  const { data: addresses = [] } = useQuery({
    queryKey: ['shipping-addresses', projectId],
    queryFn: () => api.getShippingAddresses(projectId),
  })

  const { data: shipping = [], isLoading } = useQuery({
    queryKey: ['shipping', projectId],
    queryFn: () => api.getShipping(projectId),
  })

  const deleteAddrMut = useMutation({
    mutationFn: (id: number) => api.deleteShippingAddress(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-addresses', projectId] })
      queryClient.invalidateQueries({ queryKey: ['shipping', projectId] })
    },
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['shipping-addresses', projectId] })
    queryClient.invalidateQueries({ queryKey: ['shipping', projectId] })
  }

  const counts = {
    'To the Event': shipping.filter((s: any) => s.shipping_type === 'To the Event').length,
    'Unknown': shipping.filter((s: any) => s.shipping_type === 'Unknown').length,
    'To Office': shipping.filter((s: any) => s.shipping_type !== 'To the Event' && s.shipping_type !== 'Unknown').length,
  }

  const shippingColor = (type: string) => {
    if (type === 'To the Event') return 'bg-green-100 text-green-800'
    if (type === 'Unknown') return 'bg-yellow-100 text-yellow-800'
    return 'bg-blue-100 text-blue-800'
  }

  // Group shipping by destination
  const grouped: Record<string, any[]> = {}
  for (const s of shipping) {
    const key = s.shipping_type
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(s)
  }
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
    if (a === 'To the Event') return -1
    if (b === 'To the Event') return 1
    if (a === 'Unknown') return 1
    if (b === 'Unknown') return -1
    return a.localeCompare(b)
  })

  return (
    <div className="space-y-6">
      {/* Upload Addresses */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Shipping Addresses</h2>
        <div className="max-w-md mb-4">
          <FileUpload
            label="Shipping Addresses CSV"
            accept=".csv"
            onUpload={(file) => api.uploadShippingAddresses(projectId, file).then(res => {
              invalidateAll()
              return res
            })}
          />
        </div>

        {/* Collapsible Address List */}
        {addresses.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-10 px-2 py-2.5"></th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">City</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">State</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Country</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Ship To</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Company</th>
                  <th className="w-10 px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {addresses.map((addr: any) => {
                  const isExpanded = expandedAddr === addr.id
                  return (
                    <AddressRow
                      key={addr.id}
                      addr={addr}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedAddr(isExpanded ? null : addr.id)}
                      onDelete={() => deleteAddrMut.mutate(addr.id)}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {shipping.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">To the Event</div>
            <div className="text-2xl font-bold text-green-700">{counts['To the Event']}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">To Office</div>
            <div className="text-2xl font-bold text-blue-700">{counts['To Office']}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
              Unknown
              {counts['Unknown'] > 0 && <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />}
            </div>
            <div className="text-2xl font-bold text-yellow-700">{counts['Unknown']}</div>
          </div>
        </div>
      )}

      {/* Shipping Assignments */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : shipping.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No shipping data yet. Import addresses and ensure attendance is set up.</p>
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Shipping Assignments</h2>
          <div className="space-y-4">
            {sortedGroups.map(([groupName, items]) => (
              <ShippingGroup
                key={groupName}
                groupName={groupName}
                items={items}
                colorClass={shippingColor(groupName)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AddressRow({
  addr,
  isExpanded,
  onToggle,
  onDelete,
}: {
  addr: any
  isExpanded: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <>
      <tr onClick={onToggle} className="hover:bg-gray-50 cursor-pointer transition-colors">
        <td className="px-2 py-2.5 text-center text-gray-400">
          {isExpanded
            ? <ChevronDown className="w-4 h-4 mx-auto" />
            : <ChevronRight className="w-4 h-4 mx-auto" />}
        </td>
        <td className="px-4 py-2.5 font-medium">{addr.city || '-'}</td>
        <td className="px-4 py-2.5 text-gray-600">{addr.state || '-'}</td>
        <td className="px-4 py-2.5 text-gray-600">{addr.country || '-'}</td>
        <td className="px-4 py-2.5 text-gray-600">{addr.ship_to || '-'}</td>
        <td className="px-4 py-2.5 text-gray-600 text-xs">{addr.company || '-'}</td>
        <td className="px-2 py-2.5">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer border-0 bg-transparent"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="px-0 py-0">
            <div className="bg-gray-50 border-t border-gray-200 px-8 py-3 grid grid-cols-3 gap-4 text-xs">
              <div>
                <div className="text-gray-500 mb-0.5">Address</div>
                <div className="text-gray-900 font-medium">
                  {[addr.address_1, addr.address_2, addr.address_3].filter(Boolean).join(', ')}
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">Zip Code</div>
                <div className="text-gray-900 font-medium">{addr.zip_code || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">Phone</div>
                <div className="text-gray-900 font-medium">{addr.phone || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">Email</div>
                <div className="text-gray-900 font-medium">{addr.email || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">Taxable</div>
                <div className="text-gray-900 font-medium">{addr.taxable ? 'Yes' : 'No'}</div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function ShippingGroup({
  groupName,
  items,
  colorClass,
}: {
  groupName: string
  items: any[]
  colorClass: string
}) {
  const [collapsed, setCollapsed] = useState(false)
  const addr = items[0]?.shipping_address

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          {collapsed
            ? <ChevronRight className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />}
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}>
            {groupName}
          </span>
          <span className="text-sm text-gray-600 font-medium">{items.length} inventor{items.length !== 1 ? 's' : ''}</span>
        </div>
        {addr && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin className="w-3 h-3" />
            {[addr.address_1, addr.city, addr.state, addr.country].filter(Boolean).join(', ')}
          </div>
        )}
      </div>
      {!collapsed && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Name</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Employee ID</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Work City</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Attendance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((s: any) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">{s.inventor_name}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-600">{s.employee_id}</td>
                <td className="px-4 py-2 text-gray-600">{s.work_city || '-'}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    s.attendance_status === 'In-Person' ? 'bg-green-100 text-green-800'
                    : s.attendance_status === 'Not Attending' ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-700'
                  }`}>
                    {s.attendance_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
