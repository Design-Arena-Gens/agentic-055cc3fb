"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Resolution = "720p" | "1080p" | "Square";

function getSize(resolution: Resolution): { width: number; height: number } {
  switch (resolution) {
    case "720p":
      return { width: 1280, height: 720 };
    case "1080p":
      return { width: 1920, height: 1080 };
    case "Square":
      return { width: 1080, height: 1080 };
  }
}

type Cat = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
};

export default function HomePage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [durationSec, setDurationSec] = useState(8);
  const [numCats, setNumCats] = useState(6);
  const [resolution, setResolution] = useState<Resolution>("720p");
  const [fps, setFps] = useState(30);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [size, setSize] = useState(getSize("720p"));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const catsRef = useRef<Cat[]>([]);

  useEffect(() => {
    setSize(getSize(resolution));
  }, [resolution]);

  const reset = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    recordedChunksRef.current = [];
    setIsGenerating(false);
  }, []);

  useEffect(() => {
    return () => reset();
  }, [reset]);

  const drawBackground = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    const hue = (t * 15) % 360;
    g.addColorStop(0, `hsl(${(hue + 200) % 360} 70% 12%)`);
    g.addColorStop(1, `hsl(${(hue + 260) % 360} 70% 18%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // subtle stars
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "white";
    for (let i = 0; i < 40; i++) {
      const x = ((i * 127) % w) + ((t * 40 + i * 13) % 1);
      const y = ((i * 59) % h) + ((t * 25 + i * 19) % 1);
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const drawCat = (ctx: CanvasRenderingContext2D, cat: Cat) => {
    const { x, y, size, hue } = cat;
    ctx.save();
    ctx.translate(x, y);
    // body
    ctx.fillStyle = `hsl(${hue} 70% 60%)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.7, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // head
    ctx.beginPath();
    ctx.arc(size * 0.6, -size * 0.35, size * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // ears
    ctx.beginPath();
    ctx.moveTo(size * 0.45, -size * 0.75);
    ctx.lineTo(size * 0.6, -size * 0.45);
    ctx.lineTo(size * 0.75, -size * 0.75);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(size * 0.75, -size * 0.75);
    ctx.lineTo(size * 0.95, -size * 0.45);
    ctx.lineTo(size * 1.05, -size * 0.75);
    ctx.closePath();
    ctx.fill();

    // tail
    ctx.beginPath();
    ctx.strokeStyle = `hsl(${hue} 60% 45%)`;
    ctx.lineWidth = Math.max(2, size * 0.1);
    ctx.lineCap = "round";
    ctx.quadraticCurveTo(-size * 0.5, -size * 0.6, -size * 0.2, -size * 1.0);
    ctx.stroke();

    // face
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(size * 0.6, -size * 0.35, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size * 0.9, -size * 0.35, size * 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0b1220";
    ctx.beginPath();
    ctx.arc(size * 0.6, -size * 0.35, size * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size * 0.9, -size * 0.35, size * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // nose
    ctx.fillStyle = "#ec4899";
    ctx.beginPath();
    ctx.moveTo(size * 0.75, -size * 0.25);
    ctx.lineTo(size * 0.7, -size * 0.2);
    ctx.lineTo(size * 0.8, -size * 0.2);
    ctx.closePath();
    ctx.fill();

    // whiskers
    ctx.strokeStyle = "#fefefe";
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.beginPath();
    ctx.moveTo(size * 0.6, -size * 0.18);
    ctx.lineTo(size * 0.4, -size * 0.15);
    ctx.moveTo(size * 0.6, -size * 0.22);
    ctx.lineTo(size * 0.4, -size * 0.25);
    ctx.moveTo(size * 0.9, -size * 0.18);
    ctx.lineTo(size * 1.1, -size * 0.15);
    ctx.moveTo(size * 0.9, -size * 0.22);
    ctx.lineTo(size * 1.1, -size * 0.25);
    ctx.stroke();

    ctx.restore();
  };

  const initCats = useCallback((w: number, h: number) => {
    const cats: Cat[] = [];
    for (let i = 0; i < numCats; i++) {
      const size = Math.max(24, Math.min(w, h) * (0.04 + Math.random() * 0.06));
      cats.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() * 2 - 1) * (0.4 + Math.random() * 1.2),
        vy: (Math.random() * 2 - 1) * (0.4 + Math.random() * 1.2),
        size,
        hue: Math.floor(Math.random() * 360)
      });
    }
    catsRef.current = cats;
  }, [numCats]);

  const animate = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsedMs = timestamp - startTimeRef.current;
    const elapsedSec = elapsedMs / 1000;

    drawBackground(ctx, w, h, elapsedSec);

    // move cats
    const cats = catsRef.current;
    const speedScale = 60 / fps; // normalize roughly to fps
    for (const cat of cats) {
      cat.x += cat.vx * speedScale * 2.5;
      cat.y += cat.vy * speedScale * 2.5;
      // bounce off edges
      const pad = cat.size * 0.6;
      if (cat.x < pad) { cat.x = pad; cat.vx *= -1; }
      if (cat.x > w - pad) { cat.x = w - pad; cat.vx *= -1; }
      if (cat.y < pad) { cat.y = pad; cat.vy *= -1; }
      if (cat.y > h - pad) { cat.y = h - pad; cat.vy *= -1; }
      // slight hue drift
      cat.hue = (cat.hue + 0.2) % 360;
      drawCat(ctx, cat);
    }

    // floating title
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "white";
    ctx.font = `${Math.floor(Math.min(w, h) * 0.06)}px ui-sans-serif, system-ui, -apple-system`;
    const message = "Meow!";
    const tw = ctx.measureText(message).width;
    const tx = w / 2 - tw / 2;
    const ty = h * (0.16 + Math.sin(elapsedSec * 1.5) * 0.02);
    ctx.fillText(message, tx, ty);
    ctx.restore();

    if (elapsedSec < durationSec) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      // stop recording at end
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      animationFrameRef.current = null;
      setIsGenerating(false);
    }
  }, [durationSec, fps]);

  const startGeneration = useCallback(async () => {
    setVideoUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setIsGenerating(true);
    startTimeRef.current = 0;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height } = size;
    canvas.width = width;
    canvas.height = height;

    initCats(width, height);

    // capture video stream from canvas
    const stream = canvas.captureStream(fps);

    let mimeType = "video/webm; codecs=vp9";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "video/webm; codecs=vp8";
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "video/webm";
    }

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 5_000_000
    });

    recordedChunksRef.current = [];

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [animate, fps, initCats, size]);

  const disabled = isGenerating;

  const fileName = useMemo(() => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    return `cat-video-${ts}.webm`;
  }, [videoUrl]);

  return (
    <div className="container">
      <div className="header" style={{ marginBottom: 16 }}>
        <span className="badge"><span>??</span><strong>Cat Video Generator</strong></span>
        <span className="subtle">Create a meow-tastic video in your browser</span>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="controls" style={{ marginBottom: 12 }}>
          <div className="control">
            <label>Duration (seconds)</label>
            <input type="number" min={3} max={30} value={durationSec}
              onChange={(e) => setDurationSec(Math.max(3, Math.min(30, Number(e.target.value) || 8)))} />
          </div>
          <div className="control">
            <label>Cats</label>
            <input type="number" min={1} max={20} value={numCats}
              onChange={(e) => setNumCats(Math.max(1, Math.min(20, Number(e.target.value) || 6)))} />
          </div>
          <div className="control">
            <label>Resolution</label>
            <select value={resolution} onChange={(e) => setResolution(e.target.value as Resolution)}>
              <option value="720p">1280?720 (HD)</option>
              <option value="1080p">1920?1080 (FHD)</option>
              <option value="Square">1080?1080 (Square)</option>
            </select>
          </div>
          <div className="control">
            <label>FPS</label>
            <input type="number" min={15} max={60} value={fps}
              onChange={(e) => setFps(Math.max(15, Math.min(60, Number(e.target.value) || 30)))} />
          </div>
        </div>
        <div className="row">
          <button className="primary" disabled={disabled} onClick={startGeneration}>Generate video</button>
          {isGenerating && <span className="subtle">Rendering and recording... Please wait</span>}
        </div>
      </div>

      <div className="card">
        <div className="canvasWrap" style={{ aspectRatio: `${size.width}/${size.height}` }}>
          <canvas ref={canvasRef} style={{ width: "100%", height: "auto", display: "block" }} />
        </div>
        <div className="small subtle" style={{ marginTop: 8 }}>Canvas preview is live-rendered; the final video appears below after recording.</div>
      </div>

      {videoUrl && (
        <div className="card videoWrap" style={{ marginTop: 16 }}>
          <video controls src={videoUrl} />
          <div className="row" style={{ marginTop: 8, justifyContent: "space-between" }}>
            <a download={fileName} href={videoUrl} className="primary" style={{ textDecoration: "none", padding: "10px 14px", borderRadius: 10, background: "#111827", color: "white", fontWeight: 700 }}>Download WebM</a>
            <span className="small subtle">Tip: Most browsers and social apps accept WebM. Convert to MP4 if needed.</span>
          </div>
        </div>
      )}

      <div className="footer">Made with Next.js. Video is generated fully in your browser using the Canvas and MediaRecorder APIs.</div>
    </div>
  );
}
