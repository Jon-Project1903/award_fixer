import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import FileUpload from './FileUpload'
import { Package, ChevronDown, ChevronRight, Trash2, AlertTriangle, MapPin, Plus, Check, X, Pencil } from 'lucide-react'

const EMPTY_ADDR = {
  city: '', state: '', country: '', company: '', ship_to: '', email: '',
  address_1: '', address_2: '', address_3: '', phone: '', zip_code: '', taxable: false,
}

export default function ShippingTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()
  const [expandedAddr, setExpandedAddr] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<any>({})
  const [adding, setAdding] = useState(false)
  const [newAddr, setNewAddr] = useState<any>({ ...EMPTY_ADDR })

  const { data: addresses = [] } = useQuery({
    queryKey: ['shipping-addresses', projectId],
    queryFn: () => api.getShippingAddresses(projectId),
  })

  const { data: shipping = [], isLoading } = useQuery({
    queryKey: ['shipping', projectId],
    queryFn: () => api.getShipping(projectId),
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['shipping-addresses', projectId] })
    queryClient.invalidateQueries({ queryKey: ['shipping', projectId] })
  }

  const createMut = useMutation({
    mutationFn: (data: any) => api.createShippingAddress(projectId, data),
    onSuccess: () => { invalidateAll(); setAdding(false); setNewAddr({ ...EMPTY_ADDR }) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateShippingAddress(projectId, id, data),
    onSuccess: () => { invalidateAll(); setEditingId(null) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteShippingAddress(projectId, id),
    onSuccess: invalidateAll,
  })

  const startEdit = (addr: any) => {
    setEditingId(addr.id)
    setEditData({ ...addr })
    setExpandedAddr(addr.id)
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Shipping Addresses</h2>
          <button
            onClick={() => { setAdding(true); setNewAddr({ ...EMPTY_ADDR }) }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 cursor-pointer border-0 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Address
          </button>
        </div>
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

        {/* Address Table */}
        {(addresses.length > 0 || adding) && (
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
                  <th className="w-20 px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {addresses.map((addr: any) => {
                  const isExpanded = expandedAddr === addr.id
                  const isEditing = editingId === addr.id
                  return (
                    <AddressRow
                      key={addr.id}
                      addr={addr}
                      isExpanded={isExpanded}
                      isEditing={isEditing}
                      editData={editData}
                      onEditChange={setEditData}
                      onToggle={() => setExpandedAddr(isExpanded ? null : addr.id)}
                      onEdit={() => startEdit(addr)}
                      onSave={() => updateMut.mutate({ id: addr.id, data: editData })}
                      onCancel={() => setEditingId(null)}
                      onDelete={() => deleteMut.mutate(addr.id)}
                    />
                  )
                })}
                {adding && (
                  <AddingRow
                    data={newAddr}
                    onChange={setNewAddr}
                    onSave={() => createMut.mutate(newAddr)}
                    onCancel={() => setAdding(false)}
                  />
                )}
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

const inputCls = "w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"

function AddressRow({
  addr, isExpanded, isEditing, editData, onEditChange,
  onToggle, onEdit, onSave, onCancel, onDelete,
}: {
  addr: any; isExpanded: boolean; isEditing: boolean
  editData: any; onEditChange: (d: any) => void
  onToggle: () => void; onEdit: () => void
  onSave: () => void; onCancel: () => void; onDelete: () => void
}) {
  const ed = (field: string, value: any) => onEditChange({ ...editData, [field]: value })
  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') onSave() }

  if (isEditing) {
    return (
      <>
        <tr className="bg-blue-50/50">
          <td className="px-2 py-2.5 text-center text-gray-400">
            <ChevronDown className="w-4 h-4 mx-auto" />
          </td>
          <td className="px-4 py-2.5"><input className={inputCls} value={editData.city || ''} onChange={e => ed('city', e.target.value)} onKeyDown={handleKey} /></td>
          <td className="px-4 py-2.5"><input className={inputCls} value={editData.state || ''} onChange={e => ed('state', e.target.value)} onKeyDown={handleKey} /></td>
          <td className="px-4 py-2.5"><input className={inputCls} value={editData.country || ''} onChange={e => ed('country', e.target.value)} onKeyDown={handleKey} /></td>
          <td className="px-4 py-2.5"><input className={inputCls} value={editData.ship_to || ''} onChange={e => ed('ship_to', e.target.value)} onKeyDown={handleKey} /></td>
          <td className="px-4 py-2.5"><input className={inputCls} value={editData.company || ''} onChange={e => ed('company', e.target.value)} onKeyDown={handleKey} /></td>
          <td className="px-2 py-2.5">
            <span className="inline-flex gap-1">
              <button onClick={onSave} className="p-1 text-green-600 hover:bg-green-50 rounded cursor-pointer border-0 bg-transparent"><Check className="w-4 h-4" /></button>
              <button onClick={onCancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded cursor-pointer border-0 bg-transparent"><X className="w-4 h-4" /></button>
            </span>
          </td>
        </tr>
        <tr>
          <td colSpan={7} className="px-0 py-0">
            <div className="bg-blue-50/30 border-t border-gray-200 px-8 py-3 grid grid-cols-3 gap-4 text-xs">
              <div>
                <div className="text-gray-500 mb-0.5">Address 1</div>
                <input className={inputCls} value={editData.address_1 || ''} onChange={e => ed('address_1', e.target.value)} onKeyDown={handleKey} />
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">Address 2</div>
                <input className={inputCls} value={editData.address_2 || ''} onChange={e => ed('address_2', e.target.value)} onKeyDown={handleKey} />
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">Address 3</div>
                <input className={inputCls} value={editData.address_3 || ''} onChange={e => ed('address_3', e.target.value)} onKeyDown={handleKey} />
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">Zip Code</div>
                <input className={inputCls} value={editData.zip_code || ''} onChange={e => ed('zip_code', e.target.value)} onKeyDown={handleKey} />
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">Phone</div>
                <input className={inputCls} value={editData.phone || ''} onChange={e => ed('phone', e.target.value)} onKeyDown={handleKey} />
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">Email</div>
                <input className={inputCls} value={editData.email || ''} onChange={e => ed('email', e.target.value)} onKeyDown={handleKey} />
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">Taxable</div>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editData.taxable || false} onChange={e => ed('taxable', e.target.checked)} className="rounded" />
                  <span className="text-sm">Yes</span>
                </label>
              </div>
            </div>
          </td>
        </tr>
      </>
    )
  }

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
          <span className="inline-flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer border-0 bg-transparent"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer border-0 bg-transparent"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </span>
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

function AddingRow({
  data, onChange, onSave, onCancel,
}: {
  data: any; onChange: (d: any) => void; onSave: () => void; onCancel: () => void
}) {
  const ed = (field: string, value: any) => onChange({ ...data, [field]: value })
  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') onSave() }
  return (
    <>
      <tr className="bg-blue-50/50">
        <td className="px-2 py-2.5 text-center text-gray-400">
          <ChevronDown className="w-4 h-4 mx-auto" />
        </td>
        <td className="px-4 py-2.5"><input className={inputCls} value={data.city} onChange={e => ed('city', e.target.value)} onKeyDown={handleKey} placeholder="City" /></td>
        <td className="px-4 py-2.5"><input className={inputCls} value={data.state} onChange={e => ed('state', e.target.value)} onKeyDown={handleKey} placeholder="State" /></td>
        <td className="px-4 py-2.5"><input className={inputCls} value={data.country} onChange={e => ed('country', e.target.value)} onKeyDown={handleKey} placeholder="Country" /></td>
        <td className="px-4 py-2.5"><input className={inputCls} value={data.ship_to} onChange={e => ed('ship_to', e.target.value)} onKeyDown={handleKey} placeholder="Ship To" /></td>
        <td className="px-4 py-2.5"><input className={inputCls} value={data.company} onChange={e => ed('company', e.target.value)} onKeyDown={handleKey} placeholder="Company" /></td>
        <td className="px-2 py-2.5">
          <span className="inline-flex gap-1">
            <button onClick={onSave} className="p-1 text-green-600 hover:bg-green-50 rounded cursor-pointer border-0 bg-transparent"><Check className="w-4 h-4" /></button>
            <button onClick={onCancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded cursor-pointer border-0 bg-transparent"><X className="w-4 h-4" /></button>
          </span>
        </td>
      </tr>
      <tr>
        <td colSpan={7} className="px-0 py-0">
          <div className="bg-blue-50/30 border-t border-gray-200 px-8 py-3 grid grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-gray-500 mb-0.5">Address 1</div>
              <input className={inputCls} value={data.address_1} onChange={e => ed('address_1', e.target.value)} onKeyDown={handleKey} placeholder="Address 1" />
            </div>
            <div>
              <div className="text-gray-500 mb-0.5">Address 2</div>
              <input className={inputCls} value={data.address_2} onChange={e => ed('address_2', e.target.value)} onKeyDown={handleKey} placeholder="Address 2" />
            </div>
            <div>
              <div className="text-gray-500 mb-0.5">Address 3</div>
              <input className={inputCls} value={data.address_3} onChange={e => ed('address_3', e.target.value)} onKeyDown={handleKey} placeholder="Address 3" />
            </div>
            <div>
              <div className="text-gray-500 mb-0.5">Zip Code</div>
              <input className={inputCls} value={data.zip_code} onChange={e => ed('zip_code', e.target.value)} onKeyDown={handleKey} placeholder="Zip Code" />
            </div>
            <div>
              <div className="text-gray-500 mb-0.5">Phone</div>
              <input className={inputCls} value={data.phone} onChange={e => ed('phone', e.target.value)} onKeyDown={handleKey} placeholder="Phone" />
            </div>
            <div>
              <div className="text-gray-500 mb-0.5">Email</div>
              <input className={inputCls} value={data.email} onChange={e => ed('email', e.target.value)} onKeyDown={handleKey} placeholder="Email" />
            </div>
            <div>
              <div className="text-gray-500 mb-0.5">Taxable</div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={data.taxable} onChange={e => ed('taxable', e.target.checked)} className="rounded" />
                <span className="text-sm">Yes</span>
              </label>
            </div>
          </div>
        </td>
      </tr>
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
