import { useMemo } from "react";

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

type AdminSubmissionOverviewProps = {
  detail: SubmissionDetail;
  saving: boolean;
  onBack: () => void;
  onDecide: (decision: "verified" | "invalid") => void;
  onDelete: () => void;
};

export default function AdminSubmissionOverview({
  detail,
  saving,
  onDecide,
}: AdminSubmissionOverviewProps) {
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

  return (
    <article className="overview-panel w-full max-w-[800px] rounded-xl border border-[var(--line)] bg-transparent p-5 mt-4 ml-5">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-3 gap-y-2 text-base">
        <div className="bg-transparent p-3 flex items-start justify-start min-h-[96px]">
          <img
            src="/images/profile-placeholder.png"
            alt="Profile placeholder"
            className="h-14 w-14 rounded-full object-cover"
          />
        </div>
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
        <div className="bg-transparent p-3 xl:col-span-4">
          <span>Documents:</span>
          <div className="mt-3">
            {documents.length > 0 ? (
              <ul className="space-y-2">
                {documents.map((docPath, index) => {
                  const lowerPath = docPath.toLowerCase();
                  const fileName = decodeURIComponent(
                    docPath.split("/").pop() || `document-${index + 1}`,
                  );
                  const typeLogo = lowerPath.endsWith(".pdf")
                    ? "/images/pdf.png"
                    : null;
                  return (
                    <li
                      key={`${docPath}-${index}`}
                      className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[#121317] px-3 py-2"
                    >
                      <div className="h-12 w-12 overflow-hidden rounded bg-[#1f1f21] flex items-center justify-center">
                        <img
                          src={typeLogo ?? docPath}
                          alt=""
                          aria-hidden="true"
                          className={
                            typeLogo
                              ? "h-full w-full object-contain p-1.5"
                              : "h-full w-full object-cover"
                          }
                        />
                      </div>
                      <p className="min-w-0 flex-1 truncate font-semibold text-base">
                        {fileName}
                      </p>
                      <a
                        href={docPath}
                        download={fileName}
                        className="shrink-0 transition-opacity hover:opacity-100"
                        aria-label={`Download ${fileName}`}
                      >
                        <img
                          src="/icons/download.svg"
                          alt=""
                          className="h-6 w-6"
                        />
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

      <div className="actions justify-end">
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
    </article>
  );
}
