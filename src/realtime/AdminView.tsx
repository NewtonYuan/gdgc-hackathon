import { useEffect, useState } from "react";
import AdminSubmissionOverview from "./AdminSubmissionOverview";
import AdminLayout from "./AdminLayout";

type SubmissionSummary = {
  id: string;
  name: string;
  phone: string;
  occupation: string;
  cardId: string;
  createdAt: string;
  decision: "pending" | "verified" | "invalid";
};

type SubmissionDetail = SubmissionSummary & {
  cardPayload: string;
  documentPath: string | null;
  decidedAt: string | null;
  age: number | null;
  gender: string | null;
  trustScore: number;
  employment: {
    jobTitle: string;
    employer: string;
    workAddress: string;
  } | null;
  student: {
    institution: string;
    studentId: string;
    fieldOfStudy: string;
    yearOfStudy: number | null;
  } | null;
  retired: {
    formerOccupation: string;
  } | null;
};

type ProfileConnection = {
  profileId: string;
  cardId: string;
  name: string;
  verificationStatus: string;
  trustScore: number;
  status: "auto_linked" | "suggested";
  confidence: number;
  matchBreakdown: Record<string, number>;
};

type ProfileConnections = {
  autoLinked: ProfileConnection[];
  suggested: ProfileConnection[];
};

function readSelectedIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function fetchJsonOrThrow<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      "Admin API returned non-JSON response. Ensure node server is running on :3000.",
    );
  }

  if (!res.ok) {
    const msg =
      typeof parsed === "object" && parsed !== null && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : `Request failed: ${res.status}`;
    throw new Error(msg);
  }

  return parsed as T;
}

export default function AdminView() {
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    readSelectedIdFromUrl(),
  );
  const [rows, setRows] = useState<SubmissionSummary[]>([]);
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connections, setConnections] = useState<ProfileConnections>({
    autoLinked: [],
    suggested: [],
  });
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId) {
      return;
    }

    let active = true;
    fetchJsonOrThrow<{
      ok: boolean;
      submissions: SubmissionSummary[];
      error?: string;
    }>("/api/admin/submissions")
      .then((json) => {
        if (!active) {
          return;
        }
        if (!json.ok) {
          throw new Error(json.error ?? "Failed to load submissions");
        }
        setRows(json.submissions);
      })
      .catch((cause: unknown) => {
        if (active) {
          setRows([]);
          setError(
            cause instanceof Error
              ? cause.message
              : "Failed to load submissions",
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
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    let active = true;
    fetchJsonOrThrow<{
      ok: boolean;
      submission?: SubmissionDetail;
      error?: string;
    }>(`/api/admin/submissions/${encodeURIComponent(selectedId)}`)
      .then((json) => {
        if (!active) {
          return;
        }
        if (!json.ok || !json.submission) {
          throw new Error(json.error ?? "Submission not found");
        }
        setDetail(json.submission);
      })
      .catch((cause: unknown) => {
        if (active) {
          setDetail(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "Failed to load submission",
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
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    let active = true;

    fetchJsonOrThrow<{
      ok: boolean;
      error?: string;
    }>(`/api/profiles/${encodeURIComponent(selectedId)}/rediscover`, {
      method: "POST",
    })
      .then((json) => {
        if (!json.ok) {
          throw new Error(json.error ?? "Failed to scan connections");
        }
        return fetchJsonOrThrow<{
          ok: boolean;
          connections?: ProfileConnections;
          error?: string;
        }>(`/api/profiles/${encodeURIComponent(selectedId)}/connections`);
      })
      .then((json) => {
        if (!active) {
          return;
        }
        if (!json.ok || !json.connections) {
          throw new Error(json.error ?? "Failed to load connections");
        }
        setConnections(json.connections);
      })
      .catch((cause: unknown) => {
        if (active) {
          setConnections({ autoLinked: [], suggested: [] });
          setConnectionsError(
            cause instanceof Error
              ? cause.message
              : "Failed to load connections",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [selectedId]);

  const openVerify = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("id", id);
    window.history.pushState({}, "", url);
    setLoading(true);
    setSelectedId(id);
    setConnections({ autoLinked: [], suggested: [] });
    setConnectionsError(null);
    setError(null);
  };

  const backToList = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    window.history.pushState({}, "", url);
    setLoading(true);
    setSelectedId(null);
    setDetail(null);
    setConnections({ autoLinked: [], suggested: [] });
    setConnectionsError(null);
    setError(null);
  };

  const decide = async (decision: "verified" | "invalid") => {
    if (!detail) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const json = await fetchJsonOrThrow<{ ok: boolean; error?: string }>(
        `/api/admin/submissions/${encodeURIComponent(detail.id)}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );

      if (!json.ok) {
        throw new Error(json.error ?? "Failed to save decision");
      }

      setRows((prev) =>
        prev.map((row) =>
          row.id === detail.id ? { ...row, decision } : row,
        ),
      );
      setDetail((prev) =>
        prev
          ? { ...prev, decision, decidedAt: new Date().toISOString() }
          : prev,
      );
      window.dispatchEvent(new CustomEvent("admin-submission-updated"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to save decision",
      );
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    total: rows.length,
    pending: rows.filter((r) => r.decision === "pending").length,
    accepted: rows.filter((r) => r.decision === "verified").length,
    declined: rows.filter((r) => r.decision === "invalid").length,
  };
  const filteredRows = rows;
  const pieVerified =
    stats.total === 0 ? 0 : Math.round((stats.accepted / stats.total) * 360);
  const piePending =
    stats.total === 0 ? 0 : Math.round((stats.pending / stats.total) * 360);
  const pieInvalid = Math.max(0, 360 - pieVerified - piePending);
  const selectedName =
    detail?.name ?? rows.find((row) => row.id === selectedId)?.name ?? null;
  const submissionsTitle = selectedName ?? "Submissions";

  const deleteSubmission = async () => {
    if (!detail) {
      return;
    }

    const confirmed = window.confirm("Delete this submission permanently?");
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const json = await fetchJsonOrThrow<{ ok: boolean; error?: string }>(
        `/api/admin/submissions/${encodeURIComponent(detail.id)}`,
        {
          method: "DELETE",
        },
      );
      if (!json.ok) {
        throw new Error(json.error ?? "Failed to delete submission");
      }
      setRows((prev) => prev.filter((row) => row.id !== detail.id));
      window.dispatchEvent(new CustomEvent("admin-submission-updated"));
      backToList();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to delete submission",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout active="submissions" breadcrumbExtra={selectedName}>
        <article className="panel">
          <h2>Loading Admin View...</h2>
        </article>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout active="submissions" breadcrumbExtra={selectedName}>
      <section className="admin-page-shell">
        <section className={`admin-header-grid ${detail ? "submission-detail-header-grid" : ""}`}>
          <div className="admin-header-left">
            <header className="admin-page-head submission-detail-heading border-0 flex items-center justify-between gap-4">
              <h1 className="text-4xl">{submissionsTitle}</h1>
              {detail ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 bg-transparent border-0 p-0 text-red-300 hover:text-red-200 shadow-none"
                  style={{ boxShadow: "none" }}
                  onClick={deleteSubmission}
                  aria-label="Delete submission"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 -960 960 960"
                    className="h-5 w-5"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" />
                  </svg>
                  <span className="text-base font-semibold">Delete</span>
                </button>
              ) : null}
            </header>
          </div>
          <aside className="panel admin-summary-card hidden">
            <h3>Submission Summary</h3>
            <div className="admin-summary-card-body">
              <div
                className="admin-pie"
                aria-label="Submissions by status"
                style={{
                  background: `conic-gradient(#2f9f49 0deg ${pieVerified}deg, #dfb463 ${pieVerified}deg ${pieVerified + piePending}deg, #e12b2b ${pieVerified + piePending}deg ${pieVerified + piePending + pieInvalid}deg)`,
                }}
              />
              <ul className="admin-legend">
                <li>
                  <span className="dot verified-dot" />
                  Verified: {stats.accepted}
                </li>
                <li>
                  <span className="dot pending-dot" />
                  Pending: {stats.pending}
                </li>
                <li>
                  <span className="dot invalid-dot" />
                  Invalid: {stats.declined}
                </li>
                <li>
                  <span className="dot total-dot" />
                  Total: {stats.total}
                </li>
              </ul>
            </div>
          </aside>
        </section>
      </section>

      {error && (
        <article className="panel" role="alert">
          <p className="tagline">{error}</p>
        </article>
      )}

      {!selectedId ? (
        <article className="ml-0.5 mt-6 admin-table-panel">
          <div className="admin-table-wrap rounded-xl">
            <table className="table-fixed">
              <colgroup>
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "34%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="p-4 pl-6">
                    Name
                  </th>
                  <th scope="col">Phone</th>
                  <th scope="col">Occupation</th>
                  <th scope="col">Card ID</th>
                  <th scope="col" className="status-col">
                    Status
                  </th>
                  <th scope="col" className="status-col">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="pl-6">
                      No submissions yet.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => openVerify(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openVerify(row.id);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td className="pl-6">
                        <div className="w-full truncate" title={row.name}>
                          <strong>{row.name}</strong>
                        </div>
                      </td>
                      <td>
                        <div className="w-full truncate" title={row.phone}>
                          {row.phone}
                        </div>
                      </td>
                      <td>
                        <div className="w-full truncate" title={row.occupation}>
                          {row.occupation}
                        </div>
                      </td>
                      <td>
                        <div className="w-full truncate" title={row.cardId}>
                          {row.cardId}
                        </div>
                      </td>
                      <td className="status-col">
                        <span className={`status-badge ${row.decision}`}>
                          <img
                            src={
                              row.decision === "verified"
                                ? "/icons/status-verified.svg"
                                : row.decision === "pending"
                                  ? "/icons/status-pending.svg"
                                  : "/icons/status-invalid.svg"
                            }
                            alt=""
                            aria-hidden="true"
                            className="status-chip-icon"
                          />
                          {row.decision === "verified"
                            ? "Verified"
                            : row.decision === "pending"
                              ? "Pending"
                              : "Invalid"}
                        </span>
                      </td>
                      <td className="status-col">
                        <img
                          src="/icons/action-edit.svg"
                          alt="Review"
                          className="mx-auto h-5 w-5"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      ) : detail ? (
        <AdminSubmissionOverview
          detail={detail}
          saving={saving}
          connections={connections}
          connectionsError={connectionsError}
          onDecide={decide}
        />
      ) : null}
    </AdminLayout>
  );
}
