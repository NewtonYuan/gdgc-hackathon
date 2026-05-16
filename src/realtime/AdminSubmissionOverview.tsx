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
  connectionsLoading: boolean;
  connectionsError: string | null;
  onBack: () => void;
  onDecide: (decision: "verified" | "invalid") => void;
  onDelete: () => void;
  onRefreshConnections: () => void;
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

function formatMatchBreakdown(breakdown: Record<string, number>) {
  const entries = Object.entries(breakdown).filter(([, value]) => value > 0);
  if (entries.length === 0) {
    return "No explanation recorded";
  }
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => `${matchLabels[key] ?? key.replaceAll("_", " ")} +${value}`)
    .join(", ");
}

function ConnectionList({ items }: { items: ProfileConnection[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="submission-connections-list">
      {items.map((item) => (
        <li key={`${item.status}-${item.profileId}`} className="submission-connection-card">
          <div className="submission-connection-main">
            <strong>{item.name || item.cardId || item.profileId}</strong>
            <span>{formatMatchBreakdown(item.matchBreakdown)}</span>
          </div>
          <div className="submission-connection-meta">
            <span className={`status-badge ${item.verificationStatus}`}>
              {item.verificationStatus || "Unknown"}
            </span>
            <b>{item.confidence}/100</b>
          </div>
        </li>
      ))}
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

export default function AdminSubmissionOverview({
  detail,
  saving,
  connections,
  connectionsLoading,
  connectionsError,
  onDecide,
  onRefreshConnections,
}: AdminSubmissionOverviewProps) {
  const [showAllConnections, setShowAllConnections] = useState(false);
  const parsedPayload = useMemo(() => {
    try {
      return JSON.parse(detail.cardPayload) as Record<string, unknown>;
    } catch {
      return {};
    }
  }, [detail.cardPayload]);

  const address =
    typeof parsedPayload.address === "string" ? parsedPayload.address : "—";
  const pid = typeof parsedPayload.pid === "string" ? parsedPayload.pid : "—";
  const parseDocuments = (documentPath: string | null) => {
    if (!documentPath) {
      return [];
    }
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
  };
  const documents = parseDocuments(detail.documentPath);
  const rankedConnections = useMemo(() => {
    const byConfidence = (left: ProfileConnection, right: ProfileConnection) =>
      right.confidence - left.confidence || left.name.localeCompare(right.name);

    return [...connections.autoLinked, ...connections.suggested].sort(byConfidence);
  }, [connections]);
  const totalConnectionCount = rankedConnections.length;
  const visibleConnectionCount = showAllConnections
    ? totalConnectionCount
    : Math.min(4, totalConnectionCount);
  const visibleConnections = rankedConnections.slice(0, visibleConnectionCount);
  const hiddenConnectionCount = totalConnectionCount - visibleConnectionCount;
  const graphHref = `/admin/graph?focus=${encodeURIComponent(detail.id)}`;

  return (
    <article className="submission-detail-layout mt-4 ml-5">
      <section className="overview-panel submission-profile-panel rounded-xl border border-[var(--line)] bg-transparent p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-3 gap-y-2 text-base">
          <div className="bg-transparent p-3">
            <span>Name:</span>
            <p className="mt-2 font-bold text-lg">{detail.name}</p>
          </div>
          <div className="bg-transparent p-3">
            <span>Phone:</span>
            <p className="mt-2 font-bold text-lg">{detail.phone}</p>
          </div>
          <div className="bg-transparent p-3">
            <span>Occupation:</span>
            <p className="mt-2 font-bold text-lg">{detail.occupation}</p>
          </div>
          <div className="bg-transparent p-3">
            <span>Address:</span>
            <p className="mt-2 font-bold text-lg">{address}</p>
          </div>
          <div className="bg-transparent p-3">
            <span>P-ID:</span>
            <p className="mt-2 font-bold text-lg">{pid}</p>
          </div>
          <div className="bg-transparent p-3">
            <span>Card ID:</span>
            <p className="mt-2 break-all font-bold text-sm">{detail.cardId}</p>
          </div>
          <div className="bg-transparent p-3">
            <span>Current decision:</span>
            <p className="mt-2">
              <span className={`status-badge ${detail.decision}`}>
                <img
                  src={
                    detail.decision === "verified"
                      ? "/icons/status-verified.svg"
                      : detail.decision === "pending"
                        ? "/icons/status-pending.svg"
                        : "/icons/status-invalid.svg"
                  }
                  alt=""
                  aria-hidden="true"
                  className="status-chip-icon"
                />
                {detail.decision === "verified"
                  ? "Verified"
                  : detail.decision === "pending"
                    ? "Pending"
                    : "Invalid"}
              </span>
            </p>
          </div>
          <div className="bg-transparent p-3 xl:col-span-3">
            <span>Documents:</span>
            <div className="mt-3">
              {documents.length > 0 ? (
                <ul className="space-y-2">
                  {documents.map((docPath, index) => {
                    const isPdf = docPath.toLowerCase().endsWith(".pdf");
                    const fileName = decodeURIComponent(
                      docPath.split("/").pop() || `document-${index + 1}`,
                    );
                    return (
                      <li
                        key={`${docPath}-${index}`}
                        className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[#121317] px-3 py-2"
                      >
                        <div className="h-12 w-12 overflow-hidden rounded bg-[#1f1f21] flex items-center justify-center">
                          {isPdf ? (
                            <span className="text-[10px] font-bold text-red-300">
                              PDF
                            </span>
                          ) : (
                            <img
                              src={docPath}
                              alt=""
                              aria-hidden="true"
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <p className="font-semibold text-base truncate">
                          {fileName}
                        </p>
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
            className="accept bg-green-700 text-white border-0 shadow-none hover:bg-green-600 transition-colors"
            disabled={saving}
            onClick={() => onDecide("verified")}
          >
            Approve
          </button>
          <button
            type="button"
            className="decline bg-red-700 text-white border-0 shadow-none hover:bg-red-600 transition-colors"
            disabled={saving}
            onClick={() => onDecide("invalid")}
          >
            Reject
          </button>
        </div>
      </section>

      <section className="overview-panel submission-connections-panel rounded-xl border border-[var(--line)] bg-transparent p-5">
        <div className="submission-connections-head">
          <div>
            <span>Network matches</span>
          </div>
          <div className="submission-connections-actions">
            <button
              type="button"
              className="button ghost submission-action-button"
              disabled={connectionsLoading}
              onClick={onRefreshConnections}
            >
              {connectionsLoading ? "Scanning..." : "Rediscover"}
            </button>
            <a
              href={graphHref}
              className="button ghost submission-action-button"
            >
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
          <p className="tagline">No possible connections yet.</p>
        ) : null}
        {hiddenConnectionCount > 0 ? (
          <button
            type="button"
            className="submission-more-link"
            onClick={() => setShowAllConnections(true)}
          >
            +{hiddenConnectionCount} more
          </button>
        ) : showAllConnections && totalConnectionCount > 4 ? (
          <button
            type="button"
            className="submission-more-link"
            onClick={() => setShowAllConnections(false)}
          >
            Show top 4
          </button>
        ) : null}
      </section>
    </article>
  );
}
