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
  onBack: () => void;
  onDecide: (decision: "verified" | "invalid") => void;
  onDelete: () => void;
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

const PROFILE_SECTIONS = [
  {
    title: "Identity",
    fields: [
      { key: "name", label: "Name" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "dateOfBirth", label: "Date of birth" },
      { key: "pid", label: "P-ID" },
      { key: "cardId", label: "Card ID" },
    ],
  },
  {
    title: "Verification",
    fields: [
      { key: "decision", label: "Status" },
      { key: "trustScore", label: "Trust score" },
    ],
  },
  {
    title: "Address",
    fields: [
      { key: "currentAddress", label: "Current address" },
      { key: "pastAddresses", label: "Past addresses" },
    ],
  },
  {
    title: "Employment",
    fields: [
      { key: "occupationType", label: "Occupation type" },
      { key: "jobTitle", label: "Job title" },
      { key: "employer", label: "Employer" },
      { key: "workAddress", label: "Work address" },
      { key: "formerOccupation", label: "Former occupation" },
    ],
  },
  {
    title: "Education",
    fields: [
      { key: "institution", label: "Institution" },
      { key: "studentId", label: "Student ID" },
      { key: "fieldOfStudy", label: "Field of study" },
      { key: "yearOfStudy", label: "Year of study" },
    ],
  },
  {
    title: "Documents",
    fields: [{ key: "documents", label: "Documents" }],
  },
] as const;

type ProfileFieldKey = (typeof PROFILE_SECTIONS)[number]["fields"][number]["key"];

function getMatchReasons(breakdown: Record<string, number>) {
  const entries = Object.entries(breakdown).filter(([, value]) => value > 0);
  return entries
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
      <img
        src={statusIcon(status)}
        alt=""
        aria-hidden="true"
        className="status-chip-icon"
      />
      {statusLabel(status)}
    </span>
  );
}

function trustTone(trustScore: number) {
  if (trustScore >= 70) return "high";
  if (trustScore >= 40) return "medium";
  return "low";
}

function normalizeValue(value: unknown) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join(", ");
  return String(value).trim();
}

function readString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = normalizeValue(payload[key]);
    if (value) return value;
  }
  return "";
}

function readList(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      const items = value.map((item) => normalizeValue(item)).filter(Boolean);
      if (items.length > 0) return items;
    }
    const text = normalizeValue(value);
    if (text) return [text];
  }
  return [];
}

function ConnectionList({ items }: { items: ProfileConnection[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="submission-connections-list">
      {items.map((item) => {
        const reasons = getMatchReasons(item.matchBreakdown);
        return (
          <li key={`${item.status}-${item.profileId}`}>
            <a
              href={`/admin?id=${encodeURIComponent(item.profileId)}`}
              className="submission-connection-card"
            >
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
                  {/* Match pills explain why this profile is relevant; trust tells admins whether that person's attestation carries weight. */}
                  <span>Trust</span>
                  <b className={`submission-score-value ${trustTone(item.trustScore)}`}>
                    {item.trustScore}/100
                  </b>
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

function DocumentList({ documents }: { documents: string[] }) {
  return (
    <ul className="submission-documents-list">
      {documents.map((docPath, index) => {
        const isPdf = docPath.toLowerCase().endsWith(".pdf");
        const fileName = decodeURIComponent(
          docPath.split("/").pop() || `document-${index + 1}`,
        );
        return (
          <li key={`${docPath}-${index}`}>
            <div className="submission-document-thumb">
              {isPdf ? (
                <span>PDF</span>
              ) : (
                <img src={docPath} alt="" aria-hidden="true" />
              )}
            </div>
            <p>{fileName}</p>
          </li>
        );
      })}
    </ul>
  );
}

function ProfileFieldValue({
  fieldKey,
  value,
  documents,
  decision,
  trustScore,
}: {
  fieldKey: ProfileFieldKey;
  value: string;
  documents: string[];
  decision: SubmissionDetail["decision"];
  trustScore: number;
}) {
  if (fieldKey === "decision") {
    return <StatusBadge status={decision} />;
  }
  if (fieldKey === "trustScore") {
    return <TrustScoreBar score={trustScore} />;
  }
  if (fieldKey === "documents") {
    return documents.length > 0 ? <DocumentList documents={documents} /> : <MissingDash />;
  }
  return value ? <p>{value}</p> : <MissingDash />;
}

function MissingDash() {
  return <p className="submission-missing-value">—</p>;
}

function TrustScoreBar({ score }: { score: number }) {
  const boundedScore = Math.min(100, Math.max(0, score));
  return (
    <div className="submission-trust-field">
      <p>{boundedScore} / 100</p>
      <div aria-hidden="true">
        <i style={{ width: `${boundedScore}%` }} />
      </div>
    </div>
  );
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
  const pastAddresses = readList(parsedPayload, ["pastAddresses", "addressHistory", "past_addresses"]);
  const profileValues: Record<ProfileFieldKey, string> = {
    name: normalizeValue(detail.name),
    phone: normalizeValue(detail.phone),
    email: readString(parsedPayload, ["email", "emailAddress"]),
    dateOfBirth: readString(parsedPayload, ["dateOfBirth", "dob", "birthDate"]),
    pid,
    cardId: normalizeValue(detail.cardId),
    decision: detail.decision,
    trustScore: normalizeValue(detail.trustScore),
    currentAddress: address,
    pastAddresses: pastAddresses.join(", "),
    occupationType: normalizeValue(detail.occupation),
    jobTitle: normalizeValue(detail.employment?.jobTitle),
    employer: normalizeValue(detail.employment?.employer),
    workAddress: normalizeValue(detail.employment?.workAddress),
    formerOccupation: normalizeValue(detail.retired?.formerOccupation),
    institution: normalizeValue(detail.student?.institution),
    studentId: normalizeValue(detail.student?.studentId),
    fieldOfStudy: normalizeValue(detail.student?.fieldOfStudy),
    yearOfStudy: normalizeValue(detail.student?.yearOfStudy),
    documents: documents.join(", "),
  };
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
        <div className="submission-profile-sections">
          {PROFILE_SECTIONS.map((section) => {
            return (
              <section key={section.title} className="submission-profile-section">
                <h3>{section.title}</h3>
                <dl className="submission-profile-grid">
                  {section.fields.map((field) => (
                    <div
                      key={field.key}
                      className={field.key === "documents" ? "submission-profile-field wide" : "submission-profile-field"}
                    >
                      <dt>{field.label}</dt>
                      <dd>
                        <ProfileFieldValue
                          fieldKey={field.key}
                          value={profileValues[field.key]}
                          documents={documents}
                          decision={detail.decision}
                          trustScore={detail.trustScore}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
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
          <h2>Network</h2>
          <div className="submission-connections-actions">
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
          <div className="submission-network-empty">
            <NetworkIcon />
            <strong>No matches found yet</strong>
            <p>Connections will appear as more profiles are added to the network.</p>
          </div>
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
