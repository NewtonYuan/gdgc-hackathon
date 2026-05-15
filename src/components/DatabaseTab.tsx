export type RecordEntry = {
  name: string
  role: string
  district: string
  status: 'Verified' | 'Missing' | 'Corrupted'
}

type DatabaseTabProps = {
  database: RecordEntry[]
}

function DatabaseTab({ database }: DatabaseTabProps) {
  return (
    <article className="panel" role="tabpanel" aria-label="Database panel">
      <h2>Database Snapshot</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>District</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {database.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.role}</td>
              <td>{row.district}</td>
              <td className={row.status.toLowerCase()}>{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  )
}

export default DatabaseTab
