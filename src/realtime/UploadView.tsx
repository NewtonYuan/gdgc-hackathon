import { useEffect, useMemo, useRef, useState } from "react";

type SubmissionResponse = {
  ok: boolean;
  id: string;
  stored: {
    citizenId: string;
    name: string;
    phone: string;
    occupation: string;
    address: string;
    cardId: string;
    documentPaths: string[];
    createdAt: string;
    trustScore: number;
  };
};

type UploadFormState = {
  name: string;
  phone: string;
  occupation: string;
  address: string;
  cardID: string;
};

type QueuedFile = {
  id: string;
  file: File;
  progress: number;
  done: boolean;
};

function createGuid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `guid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function supportsWebNfc(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg
      className="filerow-ring"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        stroke="#3b0c0c"
        strokeWidth="3"
      />
      <circle
        className="filerow-ring-track"
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 12 12)"
      />
    </svg>
  );
}

export default function UploadView() {
  const [form, setForm] = useState<UploadFormState>({
    name: "",
    phone: "",
    occupation: "",
    address: "",
    cardID: createGuid(),
  });
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [snackbar, setSnackbar] = useState<{
    tone: "error" | "success";
    title: string;
    message: string;
  } | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [waitingForTap, setWaitingForTap] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!snackbar) {
      return;
    }
    const showId = window.setTimeout(() => setSnackbarVisible(true), 10);
    const hideId = window.setTimeout(() => setSnackbarVisible(false), 3200);
    const removeId = window.setTimeout(() => setSnackbar(null), 3550);
    return () => {
      window.clearTimeout(showId);
      window.clearTimeout(hideId);
      window.clearTimeout(removeId);
    };
  }, [snackbar]);

  const cardPayload = useMemo(
    () => ({
      pid: form.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
      card_id: form.cardID,
      name: form.name,
      phone: form.phone,
      occupation: form.occupation,
      address: form.address,
      ts: new Date().toISOString(),
    }),
    [form],
  );

  const onChange = (key: keyof UploadFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addFiles = (fileList: FileList | null) => {
    if (submitting || !fileList || fileList.length === 0) {
      return;
    }
    const added: QueuedFile[] = Array.from(fileList).map((file) => ({
      id: createGuid(),
      file,
      progress: 0,
      done: false,
    }));
    setQueue((prev) => [...prev, ...added]);
  };

  const removeFile = (id: string) => {
    if (submitting) {
      return;
    }
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const openFilePicker = () => {
    if (submitting) {
      return;
    }
    fileInputRef.current?.click();
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const validateForm = (): string | null => {
    return null;
  };

  const saveToDb = async (): Promise<string> => {
    const body = new FormData();
    body.set("name", form.name);
    body.set("phone", form.phone);
    body.set("occupation", form.occupation);
    body.set("address", form.address);
    body.set("cardID", form.cardID);
    body.set("cardPayload", JSON.stringify(cardPayload));
    queue.forEach((q) => body.append("documents", q.file));

    const res = await fetch("/api/upload", { method: "POST", body });
    const json = (await res.json()) as SubmissionResponse;
    if (!res.ok || !json.ok) {
      throw new Error("Server rejected upload");
    }
    return json.id;
  };

  const onWriteCard = async () => {
    const validationError = validateForm();
    if (validationError) {
      setMessage(validationError);
      return;
    }

    if (!supportsWebNfc()) {
      setSnackbar({
        tone: "error",
        title: "Error",
        message: "NFC not support on this browser",
      });
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const ReaderCtor = (
        window as unknown as {
          NDEFReader: new () => { write: (data: string) => Promise<void> };
        }
      ).NDEFReader;
      const ndef = new ReaderCtor();
      setWaitingForTap(true);
      await ndef.write(JSON.stringify(cardPayload));
    } catch (cause) {
      setWaitingForTap(false);
      setMessage(
        cause instanceof Error
          ? `NFC write failed: ${cause.message}`
          : "NFC write failed",
      );
      setSubmitting(false);
      return;
    }
    setWaitingForTap(false);

    // NFC write succeeded; auto-save to the DB and animate the upload rings.
    setQueue((prev) => prev.map((q) => ({ ...q, progress: 0, done: false })));
    const ticker = window.setInterval(() => {
      setQueue((prev) =>
        prev.map((q) =>
          q.done
            ? q
            : {
                ...q,
                progress: Math.min(q.progress + 6 + Math.random() * 10, 94),
              },
        ),
      );
    }, 130);

    try {
      const [id] = await Promise.all([saveToDb(), sleep(1900)]);
      window.clearInterval(ticker);
      setQueue((prev) =>
        prev.map((q) => ({ ...q, progress: 100, done: true })),
      );
      setSnackbar({
        tone: "success",
        title: "Success",
        message: "Information written to NFC card",
      });
      setMessage(`NFC card written. Saved to records DB (id: ${id}).`);
    } catch (cause) {
      window.clearInterval(ticker);
      setQueue((prev) => prev.map((q) => ({ ...q, progress: 0, done: false })));
      setMessage(
        cause instanceof Error
          ? `NFC card written, but save failed: ${cause.message}`
          : "NFC card written, but save failed",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onSaveWithoutNfc = async () => {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const id = await saveToDb();
      setQueue((prev) =>
        prev.map((q) => ({ ...q, progress: 100, done: true })),
      );
      setMessage(`Saved to records DB without NFC (id: ${id}).`);
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? `Save failed: ${cause.message}`
          : "Save failed",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="terminal-shell upload-view">
      <header className="topbar">
        <a className="back-button admin-nav-item" href="/">
          <img
            src="/icons/back-nav.svg"
            alt=""
            aria-hidden="true"
            className="admin-nav-icon"
          />
          Back
        </a>
        <h1>Upload</h1>
        <p className="tagline">Write your information to an NFC card.</p>
      </header>

      <article className="panel">
        <form className="upload-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => onChange("name", e.target.value)}
            />
          </label>
          <label>
            Phone
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => onChange("phone", e.target.value)}
            />
          </label>
          <label>
            Occupation
            <input
              value={form.occupation}
              onChange={(e) => onChange("occupation", e.target.value)}
            />
          </label>
          <label>
            Address
            <input
              value={form.address}
              onChange={(e) => onChange("address", e.target.value)}
            />
          </label>

          <div className="upload-docs-field">
            <span className="upload-docs-label">Documents</span>
            <div className="upload-docs">
              <div
                className={`dropzone ${dragging ? "dragging" : ""}`}
                role="button"
                tabIndex={0}
                onClick={openFilePicker}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openFilePicker();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!submitting) setDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragging(false);
                }}
                onDrop={onDrop}
              >
                <FolderIcon className="dropzone-icon" />
                <p className="dropzone-text">Drag your files here</p>
                <div className="dropzone-divider">
                  <span>Or</span>
                </div>
                <span className="browse-link">Browse Your Computer</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              <div className="filelist">
                <div className="filelist-head">
                  <span>Uploaded File(s)</span>
                  <span className="filelist-count">
                    {queue.length} out of {queue.length} files uploaded
                  </span>
                </div>
                <div className="filelist-rows">
                  {queue.length === 0 ? (
                    <p className="filelist-empty">No files added yet.</p>
                  ) : (
                    queue.map((q) => {
                      const displayName = q.file.name || "Unnamed file";
                      return (
                        <div className="filerow" key={q.id}>
                          <FolderIcon className="filerow-icon" />
                          <span className="filerow-name" title={displayName}>
                            {displayName}
                          </span>
                          {q.done ? (
                            <CheckIcon className="filerow-check" />
                          ) : submitting ? (
                            <ProgressRing percent={q.progress} />
                          ) : (
                            <button
                              type="button"
                              className="filerow-remove"
                              onClick={() => removeFile(q.id)}
                              aria-label={`Remove ${displayName}`}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="actions">
            <button type="button" onClick={onWriteCard} disabled={submitting}>
              {submitting ? "Working..." : "Write NFC Card"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={onSaveWithoutNfc}
              disabled={submitting}
            >
              Save Without NFC
            </button>
          </div>
        </form>

        {message && (
          <p className="tagline form-message" role="status" aria-live="polite">
            {message}
          </p>
        )}
      </article>
      {snackbar ? (
        <div
          className={`fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl px-4 py-3 text-white transition-all duration-300 ease-out ${
            snackbarVisible ? "translate-x-0 opacity-100" : "translate-x-10 opacity-0"
          } ${snackbar.tone === "success" ? "bg-[#63a96b]" : "bg-[#bf6a71]"}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/85 text-xl font-black text-black">
              {snackbar.tone === "success" ? "✓" : "!"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[22px] font-extrabold leading-6">
                {snackbar.title}
              </p>
              <p className="mt-1 text-[15px] leading-5 text-white/95">
                {snackbar.message}
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {waitingForTap ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#3c414b] bg-[#1f1f21] p-6 text-white">
            <p className="text-[22px] font-extrabold leading-6">Waiting for NFC tap</p>
            <p className="mt-2 text-[15px] text-zinc-200">
              Hold the NFC card near your phone to continue.
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
