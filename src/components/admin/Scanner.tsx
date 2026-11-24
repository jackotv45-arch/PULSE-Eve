import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { checkIn, type AdminEvent, type CheckInResult } from "@/lib/admin/admin.functions";
import { errMsg, fmt } from "./useAdmin";

export default function Scanner({ event, present, total }: { event: AdminEvent; present: number; total: number }) {
  const qc = useQueryClient();
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [camError, setCamError] = useState("");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<CheckInResult | { status: "error"; message: string } | null>(null);
  const busy = useRef(false);
  const lastCode = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  async function submitCode(raw: string) {
    const c = raw.trim();
    if (!c || busy.current) return;
    if (lastCode.current.code === c && Date.now() - lastCode.current.at < 4000) return;
    lastCode.current = { code: c, at: Date.now() };
    busy.current = true;
    try {
      const r = await checkIn({ data: { eventId: event.id, code: c } });
      setResult(r);
      if (navigator.vibrate) navigator.vibrate(r.status === "ok" ? 80 : [60, 60, 60]);
      await qc.invalidateQueries({ queryKey: ["admin", "data", event.id] });
    } catch (e) {
      setResult({ status: "error", message: errMsg(e) });
    } finally {
      busy.current = false;
    }
  }

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
          if (v.readyState === v.HAVE_ENOUGH_DATA && ctx) {
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
    void submitCode(code);
    setCode("");
  }

  const ok = result?.status === "ok";
  return (
    <div className="adm-scan">
      <div>
        <div className="adm-video">
          <video ref={video} muted playsInline />
          {!on && <div className="adm-video-empty">{camError || "Activez la caméra puis présentez le QR code du billet."}</div>}
        </div>
        <div className="adm-toolbar" style={{ marginTop: 14 }}>
          <button className="button" onClick={() => { setCamError(""); setOn((o) => !o); }}>
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
