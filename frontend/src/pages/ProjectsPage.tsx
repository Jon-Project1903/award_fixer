import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Plus, FolderOpen, Trash2 } from 'lucide-react'

export default function ProjectsPage() {
  const [name, setName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createProject(name),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setName('')
      setShowForm(false)
      navigate(`/projects/${project.id}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteProject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 m-0">Projects</h1>
          <p className="text-gray-500 text-sm mt-1">Create or select a patent awards review project</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer border-0"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) createMutation.mutate(name.trim())
            }}
            className="flex gap-3"
          >
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name, e.g. CY2025 Awards Review"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer border-0"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setName('') }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer border-0 bg-transparent"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No projects yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p: any) => (
            <div
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600">{p.name}</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm('Delete this project?')) deleteMutation.mutate(p.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all cursor-pointer border-0 bg-transparent"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Created {new Date(p.created_at).toLocaleDateString()}
              </p>
              {p.total > 0 && (
                <div className="flex gap-3 mt-3 text-xs">
                  <span className="text-green-600">{p.passed} passed</span>
                  <span className="text-red-600">{p.flagged} flagged</span>
                  <span className="text-blue-600">{p.resolved} resolved</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
