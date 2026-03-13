interface Props {
  status: string
  resolved?: boolean
}

export default function StatusBadge({ status, resolved }: Props) {
  if (resolved) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        Resolved
      </span>
    )
  }
  if (status === 'Passed Auto Review') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Passed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
      Flagged
    </span>
  )
}
