import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, CameraOff, Check, ScanLine, X } from "lucide-react";
import { checkIn, type AdminEvent, type CheckInResult } from "@/lib/admin/admin.functions";
import { errMsg, fmt } from "./useAdmin";

type ScanFeedbackStatus = CheckInResult["status"] | "error";

type PendingScan = {
  eventId: string;
  token?: string;
  registrationId?: string;
  actor: string;
  at: number;
};

const SCAN_TONES: Record<ScanFeedbackStatus, { frequency: number; duration: number }[]> = {
  ok: [{ frequency: 880, duration: 0.09 }, { frequency: 1175, duration: 0.12 }],
  already: [{ frequency: 520, duration: 0.1 }, { frequency: 420, duration: 0.12 }],
  cancelled: [{ frequency: 330, duration: 0.15 }, { frequency: 240, duration: 0.2 }],
  unknown: [{ frequency: 280, duration: 0.1 }, { frequency: 280, duration: 0.1 }],
  error: [{ frequency: 180, duration: 0.28 }],
};

const SCAN_VIBRATIONS: Record<ScanFeedbackStatus, number | number[]> = {
  ok: [110, 55, 85],
  already: [45, 60, 45],
  cancelled: [110, 60, 110],
  unknown: [55, 45, 55],
  error: 180,
};

export default function Scanner({ event, present, total }: { event: AdminEvent; present: number; total: number }) {
  const qc = useQueryClient();
  const video = useRef<HTMLVideoElement>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const [on, setOn] = useState(false);
  const [camError, setCamError] = useState("");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<CheckInResult | { status: "error"; message: string } | null>(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const busy = useRef(false);
  const lastCode = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const feedbackVisibleRef = useRef(false);
  const feedbackTimer = useRef<number | null>(null);
  const pendingScans = useRef<PendingScan[]>([]);

  function showScanFeedback() {
    feedbackVisibleRef.current = true;
    setFeedbackVisible(true);
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => {
      feedbackVisibleRef.current = false;
      setFeedbackVisible(false);
      feedbackTimer.current = null;
    }, 2400);
  }

  function prepareAudio() {
    try {
      if (!window.AudioContext) return;
      const context = audioContext.current ?? new window.AudioContext();
      audioContext.current = context;
      if (context.state === "suspended") void context.resume().catch(() => {});
    } catch {
      // Le retour visuel reste disponible si le navigateur bloque l’audio.
    }
  }

  function playScanFeedback(status: ScanFeedbackStatus) {
    try {
      const context = audioContext.current;
      if (!context || context.state !== "running") return;

      let startAt = context.currentTime + 0.015;
      for (const tone of SCAN_TONES[status]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(tone.frequency, startAt);
        gain.gain.setValueAtTime(0, startAt);
        gain.gain.linearRampToValueAtTime(0.07, startAt + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + tone.duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + tone.duration);
        startAt += tone.duration + 0.055;
      }
    } catch {
      // Le retour visuel reste disponible si l’audio échoue pendant la lecture.
    }
  }

  function giveScanFeedback(status: ScanFeedbackStatus) {
    playScanFeedback(status);
    try {
      if (navigator.vibrate) navigator.vibrate(SCAN_VIBRATIONS[status]);
    } catch {
      // Certains navigateurs ne permettent pas la vibration.
    }
  }

  async function submitCode(raw: string) {
    const c = raw.trim();
    if (!c || busy.current) return;
    if (lastCode.current.code === c && Date.now() - lastCode.current.at < 4000) return;
    lastCode.current = { code: c, at: Date.now() };
    busy.current = true;
    try {
      if (!navigator.onLine) {
        pendingScans.current.push({ eventId: event.id, token: c, actor: "", at: Date.now() });
        setResult({ status: "ok", name: "Hors-ligne", reference: "en attente" });
        showScanFeedback();
        giveScanFeedback("ok");
      } else {
        const r = await checkIn({ data: { eventId: event.id, code: c } });
        setResult(r);
        showScanFeedback();
        giveScanFeedback(r.status);
        await qc.invalidateQueries({ queryKey: ["admin", "data", event.id] });
      }
    } catch (e) {
      pendingScans.current.push({ eventId: event.id, token: c, actor: "", at: Date.now() });
      setResult({ status: "error", message: "Hors-ligne — scan mis en attente" });
      showScanFeedback();
      giveScanFeedback("error");
    } finally {
      busy.current = false;
    }
  }

  useEffect(() => {
    return () => {
      if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
      if (audioContext.current && audioContext.current.state !== "closed") {
        void audioContext.current.close();
      }
    };
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      const toSync = [...pendingScans.current];
      pendingScans.current = [];
      for (const scan of toSync) {
        try {
          await checkIn({ data: { eventId: scan.eventId, code: scan.token } });
          await qc.invalidateQueries({ queryKey: ["admin", "data", event.id] });
        } catch {
          // Déjà scanné ou autre — la base gère l’unicité via row lock
        }
      }
    };
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [event.id, qc]);

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | undefined;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    (async () => {
      try {
        const jsQR = (await import("jsqr")).default;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = video.current;
        if (!v || stopped) return;
        v.srcObject = stream;
        await v.play();
        const tick = () => {
          if (stopped) return;
          if (!feedbackVisibleRef.current && v.readyState === v.HAVE_ENOUGH_DATA && ctx) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (hit?.data) void submitCode(hit.data);
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setCamError("Caméra inaccessible. Autorisez l’accès ou saisissez le code manuellement.");
        setOn(false);
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  function manual(e: FormEvent) {
    e.preventDefault();
    prepareAudio();
    void submitCode(code);
    setCode("");
  }

  const ok = result?.status === "ok";
  const feedback = result
    ? {
        title:
          result.status === "ok" ? "ENTRÉE VALIDÉE"
          : result.status === "already" ? "DÉJÀ SCANNÉ"
          : result.status === "cancelled" ? "INSCRIPTION ANNULÉE"
          : result.status === "unknown" ? "QR CODE INCONNU"
          : "ERREUR DE SCAN",
        detail:
          result.status === "ok" ? `${result.name} · ${result.reference}`
          : result.status === "already" ? `${result.name} · présence déjà enregistrée`
          : result.status === "cancelled" ? result.name
          : result.status === "unknown" ? "Ce billet n’est pas reconnu pour cet événement."
          : result.message,
        success: result.status === "ok",
      }
    : null;
  return (
    <div className="adm-scan">
      <div>
        {pendingScans.current.length > 0 && (
          <div className="adm-toolbar" style={{ marginBottom: 10, padding: 8, background: "rgba(255, 165, 0, 0.1)", border: "1px solid rgba(255, 165, 0, 0.3)", borderRadius: 6, fontSize: 11, color: "#f5a623" }}>
            ⚠ {pendingScans.current.length} scan{pendingScans.current.length > 1 ? "s" : ""} en attente de synchronisation (hors-ligne)
          </div>
        )}
        <div className="adm-video">
          <video ref={video} muted playsInline />
          {!on && <div className="adm-video-empty">{camError || "Activez la caméra puis présentez le QR code du billet."}</div>}
          {feedbackVisible && feedback && (
            <div
              className={`adm-scan-feedback ${feedback.success ? "success" : "failure"}`}
              role={feedback.success ? "status" : "alert"}
              aria-live={feedback.success ? "polite" : "assertive"}
            >
              <div className="adm-scan-feedback-icon">{feedback.success ? <Check size={52} strokeWidth={3.5} /> : <X size={52} strokeWidth={3.5} />}</div>
              <strong className="adm-scan-feedback-title">{feedback.title}</strong>
              <span className="adm-scan-feedback-detail">{feedback.detail}</span>
            </div>
          )}
        </div>
        <div className="adm-toolbar" style={{ marginTop: 14 }}>
          <button className="button" onClick={() => { if (!on) prepareAudio(); setCamError(""); setOn((o) => !o); }}>
            {on ? <>Arrêter la caméra <CameraOff size={18} /></> : <>Activer la caméra <Camera size={18} /></>}
          </button>
        </div>
        <form className="adm-toolbar" onSubmit={manual}>
          <input className="adm-input" placeholder="Code du billet (ou douchette)" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="adm-btn"><ScanLine size={14} /> Valider</button>
        </form>
        <p className="muted" style={{ fontSize: 11 }}>QR perdu ? Cherchez la personne dans « Inscrits » et validez-la manuellement.</p>
      </div>
      <div>
        <div className="adm-stats" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="adm-stat accent"><strong>{present}</strong><span>Présents</span></div>
          <div className="adm-stat"><strong>{total - present}</strong><span>Encore attendus</span></div>
        </div>
        {result && (
          <div key={lastCode.current.at} className={`adm-result ${ok ? "ok" : "bad"}`} style={{ marginTop: 22 }}>
            <div className={`eyebrow ${ok ? "green" : ""}`}>{ok ? "ENTRÉE VALIDÉE" : "ENTRÉE REFUSÉE"}</div>
            {result.status === "ok" && <><h3>{result.name.toUpperCase()}</h3><p className="muted">Réf. {result.reference}</p></>}
            {result.status === "already" && <><h3>PRÉSENCE DÉJÀ ENREGISTRÉE</h3><p>{result.name} — premier scan le {fmt(result.at)}</p></>}
            {result.status === "cancelled" && <><h3>INSCRIPTION ANNULÉE</h3><p>{result.name}</p></>}
            {result.status === "unknown" && <><h3>QR CODE INCONNU</h3><p>Ce code n’appartient pas à « {event.title} ».</p></>}
            {result.status === "error" && <><h3>ERREUR</h3><p>{result.message}</p></>}
          </div>
        )}
      </div>
    </div>
  );
}
