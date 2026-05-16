import { useCallback, useEffect, useMemo, useState } from "react";

type RecordEntry = {
  name: string;
  occupation: string;
  decision: "pending" | "verified" | "invalid";
};

type ScanEvent = {
  type: "scan";
  personId: string;
  phoneId: string;
  cardData?: Record<string, unknown>;
};

type VerdictEvent = {
  type: "verdict";
  personId: string;
  phoneId: string;
  verified: boolean;
  name: string;
  status: "PENDING" | "VERIFIED" | "INVALID";
};

function createClientId(): string {
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

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toPersonId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function readCardField(
  data: Record<string, unknown> | undefined,
  key: string,
): string {
  const value = data?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function socketUrl(role: "desktop" | "phone", deviceId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws?role=${role}&deviceId=${encodeURIComponent(deviceId)}`;
}

type DesktopRealtimeViewProps = {
  embedded?: boolean;
  title?: string;
  adminHeader?: boolean;
  showSnackbars?: boolean;
};

export function AdminRealtimeBridge() {
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [snackbars, setSnackbars] = useState<
    Array<{
      id: string;
      title: string;
      message: string;
      tone: "neutral" | "verified" | "pending" | "invalid";
      visible: boolean;
    }>
  >([]);

  const loadRecords = useCallback(() => {
    fetch("/api/admin/submissions")
      .then((res) => res.json())
      .then(
        (json: {
          ok: boolean;
          submissions?: Array<{
            name: string;
            occupation: string;
            decision: "pending" | "verified" | "invalid";
          }>;
        }) => {
          if (json.ok && Array.isArray(json.submissions)) {
            setRecords(
              json.submissions.map((item) => ({
                name: item.name,
                occupation: item.occupation,
                decision: item.decision ?? "pending",
              })),
            );
            return;
          }
          setRecords([]);
        },
      )
      .catch(() => {
        setRecords([]);
      });
  }, []);

  const showSnackbar = useCallback(
    (
      title: string,
      message: string,
      tone: "neutral" | "verified" | "pending" | "invalid" = "neutral",
    ) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setSnackbars((prev) =>
        [...prev, { id, title, message, tone, visible: false }].slice(-3),
      );
      window.setTimeout(() => {
        setSnackbars((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, visible: true } : item,
          ),
        );
      }, 10);
      window.setTimeout(() => {
        setSnackbars((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, visible: false } : item,
          ),
        );
      }, 4500);
      window.setTimeout(() => {
        setSnackbars((prev) => prev.filter((item) => item.id !== id));
      }, 4900);
    },
    [],
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ kind?: string; name?: string }>;
      const kind = custom.detail?.kind;
      const name = custom.detail?.name?.trim() || "Unknown Person";
      if (kind === "checker-connected") {
        showSnackbar("Info", "Checker connected", "neutral");
        return;
      }
      if (kind === "checker-disconnected") {
        showSnackbar("Info", "Checker disconnected", "neutral");
        return;
      }
      if (kind === "verification-success") {
        showSnackbar(
          "Success",
          `Successful verification by ${name}`,
          "verified",
        );
        return;
      }
      if (kind === "verification-invalid") {
        showSnackbar("Error", `Invalid verification by ${name}`, "invalid");
      }
    };

    window.addEventListener("desktop-snackbar-test", handler as EventListener);
    return () =>
      window.removeEventListener(
        "desktop-snackbar-test",
        handler as EventListener,
      );
  }, [showSnackbar]);

  const personMap = useMemo(() => {
    const map = new Map<string, RecordEntry>();
    for (const row of records) {
      map.set(toPersonId(row.name), row);
    }
    return map;
  }, [records]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    const handler = () => loadRecords();
    window.addEventListener("admin-submission-updated", handler);
    return () =>
      window.removeEventListener("admin-submission-updated", handler);
  }, [loadRecords]);

  useEffect(() => {
    const desktopId = createClientId();
    const ws = new WebSocket(socketUrl("desktop", desktopId));

    ws.onmessage = (event) => {
      const payload = JSON.parse(String(event.data)) as ScanEvent;
      if (payload.type !== "scan") return;

      const person = personMap.get(payload.personId);
      const verified = person?.decision === "verified";
      const status: VerdictEvent["status"] =
        person?.decision === "verified"
          ? "VERIFIED"
          : person?.decision === "invalid"
            ? "INVALID"
            : "PENDING";

      const verdict: VerdictEvent = {
        type: "verdict",
        personId: payload.personId,
        phoneId: payload.phoneId,
        verified: Boolean(verified),
        name: person?.name ?? "Unknown Person",
        status,
      };
      ws.send(JSON.stringify(verdict));
      showSnackbar(
        status === "VERIFIED"
          ? "Success"
          : status === "PENDING"
            ? "Pending"
            : "Error",
        status === "VERIFIED"
          ? "Verdict sent: Verified"
          : status === "PENDING"
            ? "Verdict sent: Pending"
            : "Verdict sent: Invalid",
        status === "VERIFIED"
          ? "verified"
          : status === "PENDING"
            ? "pending"
            : "invalid",
      );
    };

    return () => ws.close();
  }, [personMap, showSnackbar]);

  return (
    <>
      {[...snackbars].reverse().map((snackbar, index) => (
        <div
          key={snackbar.id}
          className={`fixed right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl px-4 py-3 text-white transition-all duration-300 ease-out ${
            snackbar.visible
              ? "translate-x-0 opacity-100"
              : "translate-x-10 opacity-0"
          } ${
            snackbar.tone === "verified"
              ? "bg-[#63a96b]"
              : snackbar.tone === "pending"
                ? "bg-[#b99356]"
                : snackbar.tone === "invalid"
                  ? "bg-[#bf6a71]"
                  : "bg-[#5f80c9]"
          }`}
          style={{ bottom: `${1.5 + index * 5.6}rem` }}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/85 text-xl font-black text-black">
              {snackbar.tone === "verified"
                ? "✓"
                : snackbar.tone === "pending"
                  ? "…"
                  : snackbar.tone === "invalid"
                    ? "!"
                    : "i"}
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
      ))}
    </>
  );
}

export function DesktopRealtimeView({
  embedded = false,
  title = "Desktop Verifier",
  adminHeader = false,
  showSnackbars = true,
}: DesktopRealtimeViewProps) {
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState("connecting");
  const [lastScan, setLastScan] = useState<{
    personId: string;
    phoneId: string;
    cardData?: Record<string, unknown>;
  } | null>(null);
  const [snackbars, setSnackbars] = useState<
    Array<{
      id: string;
      title: string;
      message: string;
      tone: "neutral" | "verified" | "pending" | "invalid";
      visible: boolean;
    }>
  >([]);

  const showSnackbar = useCallback(
    (
      title: string,
      message: string,
      tone: "neutral" | "verified" | "pending" | "invalid" = "neutral",
    ) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setSnackbars((prev) =>
        [...prev, { id, title, message, tone, visible: false }].slice(-3),
      );
      window.setTimeout(() => {
        setSnackbars((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, visible: true } : item,
          ),
        );
      }, 10);
      window.setTimeout(() => {
        setSnackbars((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, visible: false } : item,
          ),
        );
      }, 4500);
      window.setTimeout(() => {
        setSnackbars((prev) => prev.filter((item) => item.id !== id));
      }, 4900);
    },
    [],
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ kind?: string; name?: string }>;
      const kind = custom.detail?.kind;
      const name = custom.detail?.name?.trim() || "Unknown Person";
      if (kind === "checker-connected") {
        showSnackbar("Info", "Checker connected", "neutral");
        return;
      }
      if (kind === "checker-disconnected") {
        showSnackbar("Info", "Checker disconnected", "neutral");
        return;
      }
      if (kind === "verification-success") {
        showSnackbar(
          "Success",
          `Successful verification by ${name}`,
          "verified",
        );
        return;
      }
      if (kind === "verification-invalid") {
        showSnackbar("Error", `Invalid verification by ${name}`, "invalid");
      }
    };

    window.addEventListener("desktop-snackbar-test", handler as EventListener);
    return () =>
      window.removeEventListener(
        "desktop-snackbar-test",
        handler as EventListener,
      );
  }, [showSnackbar]);

  const personMap = useMemo(() => {
    const map = new Map<string, RecordEntry>();
    for (const row of records) {
      map.set(toPersonId(row.name), row);
    }
    return map;
  }, [records]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/submissions")
      .then((res) => res.json())
      .then(
        (json: {
          ok: boolean;
          submissions?: Array<{
            name: string;
            occupation: string;
            decision: "pending" | "verified" | "invalid";
          }>;
        }) => {
          if (active) {
            if (json.ok && Array.isArray(json.submissions)) {
              setRecords(
                json.submissions.map((item) => ({
                  name: item.name,
                  occupation: item.occupation,
                  decision: item.decision ?? null,
                })),
              );
            } else {
              setRecords([]);
            }
          }
        },
      )
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Failed to load records",
          );
          showSnackbar("Error", "Failed to load records", "invalid");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const desktopId = createClientId();
    const ws = new WebSocket(socketUrl("desktop", desktopId));

    ws.onopen = () => {
      setConnection("connected");
    };
    ws.onclose = () => {
      setConnection("disconnected");
    };
    ws.onerror = () => {
      setConnection("error");
    };
    ws.onmessage = (event) => {
      const payload = JSON.parse(String(event.data)) as ScanEvent;
      if (payload.type !== "scan") {
        return;
      }

      setLastScan({
        personId: payload.personId,
        phoneId: payload.phoneId,
        cardData: payload.cardData,
      });
      if (showSnackbars)
        showSnackbar("Info", "Card scanned on phone", "neutral");
      const person = personMap.get(payload.personId);
      const verified = person?.decision === "verified";
      const status: VerdictEvent["status"] =
        person?.decision === "verified"
          ? "VERIFIED"
          : person?.decision === "invalid"
            ? "INVALID"
            : "PENDING";

      const verdict: VerdictEvent = {
        type: "verdict",
        personId: payload.personId,
        phoneId: payload.phoneId,
        verified: Boolean(verified),
        name: person?.name ?? "Unknown Person",
        status,
      };
      ws.send(JSON.stringify(verdict));
      if (showSnackbars)
        showSnackbar(
          status === "VERIFIED"
            ? "Success"
            : status === "PENDING"
              ? "Pending"
              : "Error",
          status === "VERIFIED"
            ? "Verdict sent: Verified"
            : status === "PENDING"
              ? "Verdict sent: Pending"
              : "Verdict sent: Invalid",
          status === "VERIFIED"
            ? "verified"
            : status === "PENDING"
              ? "pending"
              : "invalid",
        );
    };

    return () => ws.close();
  }, [personMap]);

  const activeRecord = lastScan ? personMap.get(lastScan.personId) : null;
  const connectionLabel =
    connection === "connected" ? "Connected" : "Disconnected";

  const content = (
    <>
      {adminHeader ? (
        <header className="admin-page-head border-0">
          <h1 className="text-4xl">{title}</h1>
          <p className="tagline">{connectionLabel}</p>
        </header>
      ) : (
        <header className="topbar">
          <h1>{title}</h1>
          <p className="tagline">{connectionLabel}</p>
        </header>
      )}

      {error && <article className="panel">DB Error: {error}</article>}

      <article className="panel ml-4.5 mt-4">
        <h2>Last Scan</h2>
        {lastScan ? (
          (() => {
            const card = lastScan.cardData;
            const decision = activeRecord?.decision ?? "pending";
            return (
              <div className="facts">
                <p>
                  <span>Name:</span>{" "}
                  {readCardField(card, "name") ||
                    activeRecord?.name ||
                    "Unknown Person"}
                </p>
                <p>
                  <span>Phone:</span> {readCardField(card, "phone") || "—"}
                </p>
                <p>
                  <span>Occupation:</span>{" "}
                  {readCardField(card, "occupation") ||
                    activeRecord?.occupation ||
                    "—"}
                </p>
                <p>
                  <span>Address:</span> {readCardField(card, "address") || "—"}
                </p>
                <p>
                  <span>Status:</span>{" "}
                  <strong className={`scan-status scan-status--${decision}`}>
                    {decision.toUpperCase()}
                  </strong>
                </p>
              </div>
            );
          })()
        ) : (
          <p className="tagline">Waiting for phone tap events...</p>
        )}
      </article>
      {showSnackbars
        ? [...snackbars].reverse().map((snackbar, index) => (
            <div
              key={snackbar.id}
              className={`fixed right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl px-4 py-3 text-white transition-all duration-300 ease-out ${
                snackbar.visible
                  ? "translate-x-0 opacity-100"
                  : "translate-x-10 opacity-0"
              } ${
                snackbar.tone === "verified"
                  ? "bg-[#63a96b]"
                  : snackbar.tone === "pending"
                    ? "bg-[#b99356]"
                    : snackbar.tone === "invalid"
                      ? "bg-[#bf6a71]"
                      : "bg-[#5f80c9]"
              }`}
              style={{ bottom: `${1.5 + index * 5.6}rem` }}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/85 text-xl font-black text-black">
                  {snackbar.tone === "verified"
                    ? "✓"
                    : snackbar.tone === "pending"
                      ? "…"
                      : snackbar.tone === "invalid"
                        ? "!"
                        : "i"}
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
          ))
        : null}
    </>
  );

  if (embedded) {
    return content;
  }

  return <main className="terminal-shell">{content}</main>;
}

export function PhoneRealtimeView() {
  const [deviceId] = useState(() => createClientId());
  const [mockStatus] = useState<"verified" | "pending" | "invalid" | null>(
    () => {
      const params = new URLSearchParams(window.location.search);
      const mock = params.get("mock")?.toLowerCase();
      return mock === "verified" || mock === "pending" || mock === "invalid"
        ? mock
        : null;
    },
  );
  const [cardData] = useState<Record<string, unknown> | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("card");
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  });
  const [connection, setConnection] = useState(() =>
    mockStatus ? "connected" : "connecting",
  );
  const [result, setResult] = useState<{
    verified: boolean;
    name: string;
    status: "PENDING" | "VERIFIED" | "INVALID";
  } | null>(() => {
    if (mockStatus === "verified") {
      return { verified: true, name: "Preview Person", status: "VERIFIED" };
    }
    if (mockStatus === "pending") {
      return { verified: false, name: "Preview Person", status: "PENDING" };
    }
    if (mockStatus === "invalid") {
      return { verified: false, name: "Preview Person", status: "INVALID" };
    }
    return null;
  });
  const [resultOccupation, setResultOccupation] = useState("");
  const [sent, setSent] = useState(false);
  const [missingId, setMissingId] = useState(true);

  const trySendScan = useCallback(
    (personId: string, payload: Record<string, unknown> | null) => {
      const ws = (window as unknown as { __scanSocket?: WebSocket })
        .__scanSocket;
      if (ws?.readyState !== WebSocket.OPEN) {
        return false;
      }
      ws.send(
        JSON.stringify({
          type: "scan",
          personId,
          phoneId: deviceId,
          cardData: payload ?? undefined,
        }),
      );
      setResultOccupation(
        payload && typeof payload.occupation === "string"
          ? payload.occupation.trim()
          : "",
      );
      setSent(true);
      setMissingId(false);
      return true;
    },
    [deviceId],
  );

  useEffect(() => {
    if (mockStatus) {
      return;
    }
    const ws = new WebSocket(socketUrl("phone", deviceId));
    ws.onopen = () => setConnection("connected");
    ws.onclose = () => setConnection("disconnected");
    ws.onerror = () => setConnection("error");
    ws.onmessage = (event) => {
      const payload = JSON.parse(String(event.data)) as VerdictEvent;
      if (payload.type !== "verdict" || payload.phoneId !== deviceId) {
        return;
      }
      setResult({
        verified: payload.verified,
        name: payload.name,
        status: payload.status,
      });
      setSent(false);
    };
    (window as unknown as { __scanSocket?: WebSocket }).__scanSocket = ws;
    return () => ws.close();
  }, [deviceId, mockStatus]);

  useEffect(() => {
    if (mockStatus) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("pid");
    const effectivePid =
      pid ?? (typeof cardData?.pid === "string" ? cardData.pid : null);
    if (effectivePid) {
      window.setTimeout(() => {
        trySendScan(effectivePid, cardData);
      }, 250);
    }
  }, [cardData, trySendScan, mockStatus]);

  useEffect(() => {
    if (mockStatus) {
      return;
    }
    if (typeof window === "undefined" || !("NDEFReader" in window)) {
      return;
    }

    let active = true;
    let reader: {
      scan: () => Promise<void>;
      onreading: ((event: unknown) => void) | null;
    } | null = null;

    const decodeRecordText = (record: {
      recordType: string;
      data?: DataView;
      encoding?: string;
    }): string | null => {
      if (record.recordType !== "text" || !record.data) {
        return null;
      }
      const decoder = new TextDecoder(record.encoding || "utf-8");
      return decoder.decode(record.data);
    };

    const startScan = async () => {
      try {
        const ReaderCtor = (
          window as unknown as {
            NDEFReader: new () => {
              scan: () => Promise<void>;
              onreading: ((event: unknown) => void) | null;
            };
          }
        ).NDEFReader;
        reader = new ReaderCtor();
        await reader.scan();
        reader.onreading = (event: unknown) => {
          if (!active) {
            return;
          }
          const msg = event as {
            message?: {
              records?: Array<{
                recordType: string;
                data?: DataView;
                encoding?: string;
              }>;
            };
          };
          const records = msg.message?.records ?? [];
          for (const record of records) {
            const text = decodeRecordText(record);
            if (!text) {
              continue;
            }
            try {
              const parsed = JSON.parse(text) as Record<string, unknown>;
              const pid = typeof parsed.pid === "string" ? parsed.pid : null;
              if (pid) {
                trySendScan(pid, parsed);
                return;
              }
            } catch {
              // non-JSON text record, ignore
            }
          }
          setMissingId(true);
        };
      } catch {
        // scanning may require gesture or may be unsupported in this context
      }
    };

    startScan();
    return () => {
      active = false;
      if (reader) {
        reader.onreading = null;
      }
    };
  }, [deviceId, trySendScan, mockStatus]);

  useEffect(() => {
    if (mockStatus || !result) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setResult(null);
      setResultOccupation("");
      setSent(false);
    }, 5000);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [result, mockStatus]);

  const bgClass = !result
    ? "phone-neutral"
    : result.status === "VERIFIED"
      ? "phone-ok"
      : result.status === "PENDING"
        ? "phone-pending"
        : "phone-bad";
  const connectionLabel =
    connection === "connected" ? "Connected" : "Disconnected";

  return (
    <main className={`phone-screen ${bgClass}`}>
      <div
        className={`phone-card ${result ? `phone-card-${result.status.toLowerCase()}` : "phone-card-neutral"}`}
      >
        <button
          type="button"
          className="phone-back-button"
          onClick={() => window.location.assign("/")}
        >
          <img
            src="/icons/back-checker.svg"
            alt=""
            aria-hidden="true"
            className="phone-back-icon"
          />
          <span>Back</span>
        </button>
        <p className="tagline phone-connection">{connectionLabel}</p>
        {!result ? (
          <>
            <div className="phone-icon-ring">•</div>
            <h1 className="phone-title">Tap Card</h1>
            <p className="tagline phone-subtitle">
              {missingId
                ? "No person ID detected. Use NFC JSON with a pid field."
                : sent
                  ? "Scan sent. Waiting for desktop verdict..."
                  : "Waiting for card data (NFC JSON)..."}
            </p>
          </>
        ) : (
          <>
            <div className="phone-icon-ring">
              {result.status === "VERIFIED"
                ? "✓"
                : result.status === "PENDING"
                  ? "…"
                  : "✕"}
            </div>
            <h1 className="phone-title">
              {result.status === "VERIFIED"
                ? "Verified"
                : result.status === "PENDING"
                  ? "Pending"
                  : "Invalid"}
            </h1>
            <p className="phone-subtitle">
              {result.status === "VERIFIED"
                ? `${result.name} is verified.`
                : result.status === "PENDING"
                  ? `${result.name} is still pending review.`
                  : `${result.name} is invalid.`}
            </p>
            <p className="phone-subtitle">
              Occupation: {resultOccupation || "Unknown"}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
