import { useEffect, useState } from "react";
import GraphTab from "../components/GraphTab";
import type { RecordEntry } from "../lib/graphData";
import AdminLayout from "./AdminLayout";

type SubmissionSummary = {
  name: string;
  occupation: string;
  address?: string;
  decision: "pending" | "verified" | "invalid";
};

export default function AdminGraphView() {
  const [rows, setRows] = useState<RecordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/submissions")
      .then((res) => res.json())
      .then(
        (json: {
          ok: boolean;
          submissions?: SubmissionSummary[];
          error?: string;
        }) => {
          if (!active) {
            return;
          }
          if (!json.ok) {
            throw new Error(json.error ?? "Failed to load submissions");
          }
          const list = (json.submissions ?? []).map(
            (row) =>
              ({
                name: row.name,
                role: row.occupation,
                district: row.address?.trim() ? row.address : "???",
                status:
                  row.decision === "verified"
                    ? "Verified"
                    : row.decision === "pending"
                      ? "Missing"
                      : "Corrupted",
              }) satisfies RecordEntry,
          );
          setRows(list);
        },
      )
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Failed to load graph",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminLayout active="graph">
      <section className="admin-page-shell">
        <header className="admin-page-head">
          <h1>Graph</h1>
        </header>
      </section>
      {loading ? (
        <article className="panel">
          <p className="tagline">Loading graph...</p>
        </article>
      ) : error ? (
        <article className="panel">
          <p className="tagline">{error}</p>
        </article>
      ) : (
        <GraphTab database={rows} />
      )}
    </AdminLayout>
  );
}
