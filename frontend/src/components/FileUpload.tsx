import { useCallback, useState } from 'react'
import { Upload, CheckCircle, Loader2 } from 'lucide-react'

interface Props {
  label: string
  accept: string
  onUpload: (file: File) => Promise<any>
}

export default function FileUpload({ label, accept, onUpload }: Props) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [result, setResult] = useState<any>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    setStatus('uploading')
    try {
      const res = await onUpload(file)
      setResult(res)
      setStatus('done')
    } catch {
      setStatus('idle')
    }
  }, [onUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer
        ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-white'}
        ${status === 'done' ? 'border-green-300 bg-green-50' : ''}
      `}
    >
      <label className="cursor-pointer block">
        <input type="file" accept={accept} onChange={handleChange} className="hidden" />
        {status === 'idle' && (
          <>
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">{label}</p>
            <p className="text-xs text-gray-500 mt-1">Drag & drop or click to browse</p>
          </>
        )}
        {status === 'uploading' && (
          <>
            <Loader2 className="w-8 h-8 mx-auto mb-2 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-600">Uploading...</p>
          </>
        )}
        {status === 'done' && result && (
          <>
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm font-medium text-green-700">
              {result.patents_imported} patents, {result.inventors_imported} inventors imported
            </p>
          </>
        )}
      </label>
    </div>
  )
}
