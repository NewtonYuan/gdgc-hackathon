import { useMemo, useState } from "react";

type SubmissionDetail = {
  id: string;
  name: string;
  phone: string;
  occupation: string;
  cardId: string;
  createdAt: string;
  decision: "pending" | "verified" | "invalid";
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

type AdminSubmissionOverviewProps = {
  detail: SubmissionDetail;
  saving: boolean;
  connections: ProfileConnections;
  connectionsError: string | null;
  onDecide: (decision: "verified" | "invalid") => void;
};

const matchLabels: Record<string, string> = {
  current_address: "same current address",
  current_city: "same city",
  past_address: "same past address",
  past_city: "same past city",
  current_employer: "same employer",
  current_employer_overlap: "overlapping employment dates",
  past_employer: "same past employer",
  school: "same school",
  phone_number: "same phone number",
  phone_area_code: "same phone area",
  email_domain: "same work email domain",
  family_name: "same family name",
  mutual_connections: "mutual connections",
};

function getMatchReasons(breakdown: Record<string, number>) {
  return Object.entries(breakdown)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => matchLabels[key] ?? key.replaceAll("_", " "));
}

function statusLabel(status: string) {
  if (status === "verified") return "Verified";
  if (status === "pending") return "Pending";
  if (status === "invalid" || status === "denied") return "Invalid";
  if (status === "unverified") return "Unverified";
  return status ? status[0].toUpperCase() + status.slice(1) : "Unknown";
}

function statusIcon(status: string) {
  if (status === "verified") return "/icons/status-verified.svg";
  if (status === "pending") return "/icons/status-pending.svg";
  return "/icons/status-invalid.svg";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge ${status}`}>
      <img src={statusIcon(status)} alt="" aria-hidden="true" className="status-chip-icon" />
      {statusLabel(status)}
    </span>
  );
}

function trustTone(trustScore: number) {
  if (trustScore >= 70) return "high";
  if (trustScore >= 40) return "medium";
  return "low";
}

function ConnectionList({ items }: { items: ProfileConnection[] }) {
  if (items.length === 0) return null;

  return (
    <ul className="submission-connections-list">
      {items.map((item) => {
        const reasons = getMatchReasons(item.matchBreakdown);
        return (
          <li key={`${item.status}-${item.profileId}`}>
            <a href={`/admin?id=${encodeURIComponent(item.profileId)}`} className="submission-connection-card">
              <div className="submission-connection-main">
                <strong>{item.name || item.cardId || item.profileId}</strong>
                {reasons.length > 0 ? (
                  <div className="submission-reason-pills" aria-label="Match reasons">
                    {reasons.map((reason) => (
                      <span key={reason}>{reason}</span>
                    ))}
                  </div>
                ) : (
                  <p className="submission-no-reasons">No explanation recorded</p>
                )}
              </div>
              <div className="submission-connection-meta">
                <StatusBadge status={item.verificationStatus} />
                <div className="submission-score">
                  <span>Trust</span>
                  <b className={`submission-score-value ${trustTone(item.trustScore)}`}>{item.trustScore}/100</b>
                </div>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function NetworkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="6" cy="7" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="16" cy="18" r="2.5" />
      <path d="m8.3 6.8 7.4-.6M7.8 8.9l6.4 7.3M17.4 8.4l-1.1 7.2" />
    </svg>
  );
}

function parseDocuments(documentPath: string | null): string[] {
  if (!documentPath) return [];

  try {
    const parsed = JSON.parse(documentPath);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    }
    if (typeof parsed === "string" && parsed.trim()) {
      return [parsed.trim()];
    }
  } catch {
    // fallback for legacy plain-string storage
  }

  return documentPath
    .split(",")
    .map((item) => item.trim().replace(/^"+|"+$/g, ""))
    .filter(Boolean);
}

export default function AdminSubmissionOverview({
  detail,
  saving,
  connections,
  connectionsError,
  onDecide,
}: AdminSubmissionOverviewProps) {
  const [showAllConnections, setShowAllConnections] = useState(false);

  const parsedPayload = useMemo(() => {
    try {
      return JSON.parse(detail.cardPayload) as Record<string, unknown>;
    } catch {
      return {};
    }
  }, [detail.cardPayload]);

  const address = typeof parsedPayload.address === "string" ? parsedPayload.address : "-";
  const trustScore = Math.max(0, Math.min(100, Math.round(detail.trustScore)));
  const trustColorClass =
    trustScore >= 80 ? "text-[#22c55e]" : trustScore >= 50 ? "text-[#f59e0b]" : "text-[#ef4444]";
  const documents = parseDocuments(detail.documentPath);

  const rankedConnections = useMemo(() => {
    const byConfidence = (left: ProfileConnection, right: ProfileConnection) =>
      right.confidence - left.confidence || left.name.localeCompare(right.name);
    return [...connections.autoLinked, ...connections.suggested].sort(byConfidence);
  }, [connections]);

  const totalConnectionCount = rankedConnections.length;
  const visibleConnectionCount = showAllConnections ? totalConnectionCount : Math.min(4, totalConnectionCount);
  const visibleConnections = rankedConnections.slice(0, visibleConnectionCount);
  const hiddenConnectionCount = totalConnectionCount - visibleConnectionCount;
  const graphHref = `/admin/graph?focus=${encodeURIComponent(detail.id)}`;

  return (
    <article className="submission-detail-layout mt-4 ml-5">
      <section className="overview-panel w-full max-w-[800px] rounded-xl border border-[var(--line)] bg-transparent p-5">
        <div className="grid grid-cols-1 gap-x-3 gap-y-2 text-base md:grid-cols-2 xl:grid-cols-4">
          <div className="flex min-h-[96px] items-start justify-start bg-transparent p-3">
            <img src="/images/profile-placeholder.png" alt="Profile placeholder" className="h-14 w-14 rounded-full object-cover" />
          </div>
          <div className="bg-transparent p-3">
            <span>Name:</span>
            <p className="mt-2 text-lg font-bold">{detail.name}</p>
          </div>
          <div className="bg-transparent p-3">
            <span>Phone:</span>
            <p className="mt-2 text-lg font-bold">{detail.phone}</p>
          </div>
          <div className="bg-transparent p-3">
            <span>Occupation:</span>
            <p className="mt-2 text-lg font-bold">{detail.occupation}</p>
          </div>
          <div className="bg-transparent p-3">
            <span>Address:</span>
            <p className="mt-2 text-lg font-bold">{address}</p>
          </div>
          <div className="bg-transparent p-3">
            <span>Trust score:</span>
            <p className={`mt-2 text-lg font-bold ${trustColorClass}`}>{trustScore}/100</p>
          </div>
          <div className="bg-transparent p-3">
            <span>Card ID:</span>
            <p className="mt-2 break-all text-sm font-bold">{detail.cardId}</p>
          </div>
          <div className="bg-transparent p-3">
            <span>Current decision:</span>
            <p className="mt-2">
              <StatusBadge status={detail.decision} />
            </p>
          </div>
          <div className="bg-transparent p-3 xl:col-span-4">
            <span>Documents:</span>
            <div className="mt-3">
              {documents.length > 0 ? (
                <ul className="space-y-2">
                  {documents.map((docPath, index) => {
                    const lowerPath = docPath.toLowerCase();
                    const fileName = decodeURIComponent(docPath.split("/").pop() || `document-${index + 1}`);
                    const typeLogo = lowerPath.endsWith(".pdf") ? "/images/pdf.png" : null;
                    return (
                      <li key={`${docPath}-${index}`} className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[#121317] px-3 py-2">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded bg-[#1f1f21]">
                          <img
                            src={typeLogo ?? docPath}
                            alt=""
                            aria-hidden="true"
                            className={typeLogo ? "h-full w-full object-contain p-1.5" : "h-full w-full object-cover"}
                          />
                        </div>
                        <p className="min-w-0 flex-1 truncate text-base font-semibold">{fileName}</p>
                        <a
                          href={docPath}
                          download={fileName}
                          className="shrink-0 transition-opacity hover:opacity-100"
                          aria-label={`Download ${fileName}`}
                        >
                          <img src="/icons/download.svg" alt="" className="h-6 w-6" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="tagline">No document uploaded.</p>
              )}
            </div>
          </div>
        </div>
        <div className="actions submission-profile-actions justify-end">
          <button
            type="button"
            className="accept border-0 bg-green-700 text-white shadow-none transition-colors hover:bg-green-600"
            disabled={saving}
            onClick={() => onDecide("verified")}
          >
            Approve
          </button>
          <button
            type="button"
            className="decline border-0 bg-red-700 text-white shadow-none transition-colors hover:bg-red-600"
            disabled={saving}
            onClick={() => onDecide("invalid")}
          >
            Reject
          </button>
        </div>
      </section>

      <section className="overview-panel submission-connections-panel rounded-xl border border-[var(--line)] bg-transparent p-5">
        <div className="submission-connections-head">
          <h2>Network</h2>
          <div className="submission-connections-actions">
            <a href={graphHref} className="button ghost submission-action-button">
              <NetworkIcon />
              View in graph
            </a>
          </div>
        </div>
        {connectionsError ? (
          <p className="tagline" role="alert">
            {connectionsError}
          </p>
        ) : null}
        <div className="submission-connections-grid">
          <ConnectionList items={visibleConnections} />
        </div>
        {totalConnectionCount === 0 && !connectionsError ? (
          <div className="submission-network-empty">
            <NetworkIcon />
            <strong>No matches found yet</strong>
            <p>Connections will appear as more profiles are added to the network.</p>
          </div>
        ) : null}
        {hiddenConnectionCount > 0 ? (
          <button type="button" className="submission-more-link" onClick={() => setShowAllConnections(true)}>
            +{hiddenConnectionCount} more
          </button>
        ) : showAllConnections && totalConnectionCount > 4 ? (
          <button type="button" className="submission-more-link" onClick={() => setShowAllConnections(false)}>
            Show top 4
          </button>
        ) : null}
      </section>
    </article>
  );
}
