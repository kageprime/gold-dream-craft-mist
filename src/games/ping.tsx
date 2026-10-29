import { useEffect, useRef, useState } from "react";
import type { Result } from "@/lib/club";
import { MatchCard } from "@/components/match-card";
import { PALETTE, paintVirtual, roundRect, toVirtual } from "@/games/palette";
import {
  TABLE,
  VIEW,
  createMatch,
  playerSwing,
  setShade,
  startMatch,
  stepMatch,
  worldToScreen,
  type Match,
  type Shot,
} from "@/games/ping-sim";
import { playCue, setToneMuted, unlockTone } from "@/games/tone";

type Props = {
  you: string;
  sound: boolean;
  onPlay: () => void;
  onResult: (result: Result) => void;
};

type Hud = {
  phase: Match["phase"];
  you: number;
  house: number;
  message: string;
  server: Match["server"];
};

export function PingGame({ you, sound, onPlay, onResult }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const matchRef = useRef<Match>(createMatch());
  const reported = useRef(false);
  const started = useRef(false);
  const soundRef = useRef(sound);
  const onResultRef = useRef(onResult);
  const onPlayRef = useRef(onPlay);
  const gesture = useRef<{
    x: number;
    y: number;
    t: number;
    lx: number;
    ly: number;
    lt: number;
    flicked: boolean;
  } | null>(null);
  const [hud, setHud] = useState<Hud>({
    phase: "ready",
    you: 0,
    house: 0,
    message: "Tap or flick to swing",
    server: "player",
  });

  soundRef.current = sound;
  onResultRef.current = onResult;
  onPlayRef.current = onPlay;

  useEffect(() => {
    setToneMuted(!sound);
  }, [sound]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let last = performance.now();
    let prevPhase = matchRef.current.phase;
    let prevScore = 0;

    const draw = () => {
      const painted = paintVirtual(canvas, VIEW.w, VIEW.h);
      if (!painted) return;
      const { ctx } = painted;
      const m = matchRef.current;
      ctx.fillStyle = PALETTE.bg;
      ctx.fillRect(0, 0, VIEW.w, VIEW.h);

      ctx.fillStyle = "#0e1713";
      roundRect(ctx, TABLE.x - 14, TABLE.y - 14, TABLE.w + 28, TABLE.h + 28, 18);
      ctx.fill();

      ctx.fillStyle = PALETTE.felt;
      roundRect(ctx, TABLE.x, TABLE.y, TABLE.w, TABLE.h, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.feltDeep;
      ctx.fillRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h / 2);

      ctx.strokeStyle = PALETTE.fg;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 2;
      ctx.strokeRect(TABLE.x + 8, TABLE.y + 8, TABLE.w - 16, TABLE.h - 16);
      ctx.beginPath();
      const mid = worldToScreen(0, 0).y;
      ctx.moveTo(TABLE.x + 8, mid);
      ctx.lineTo(TABLE.x + TABLE.w - 8, mid);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = PALETTE.fg;
      ctx.lineWidth = 3;
      const netLeft = worldToScreen(-0.9, 0);
      const netRight = worldToScreen(0.9, 0);
      ctx.beginPath();
      ctx.moveTo(netLeft.x, netLeft.y);
      ctx.lineTo(netRight.x, netRight.y);
      ctx.stroke();
      ctx.globalAlpha = 0.45;
      for (let i = 0; i <= 10; i += 1) {
        const x = netLeft.x + ((netRight.x - netLeft.x) * i) / 10;
        ctx.beginPath();
        ctx.moveTo(x, mid - 10);
        ctx.lineTo(x, mid + 8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const drawPaddle = (x: number, z: number, fill: string) => {
        const p = worldToScreen(x, z);
        const sc = 0.76 + ((z + 1) / 2) * 0.28;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(sc, sc);
        ctx.fillStyle = fill;
        roundRect(ctx, -34, -11, 68, 22, 8);
        ctx.fill();
        ctx.restore();
      };
      drawPaddle(m.ax, -0.78, PALETTE.fg);
      drawPaddle(m.px, 0.78, PALETTE.brass);

      const shadow = worldToScreen(m.ball.x, m.ball.z, 0);
      ctx.fillStyle = "rgba(18,22,20,0.35)";
      ctx.beginPath();
      ctx.ellipse(shadow.x, shadow.y, 8, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      const ball = worldToScreen(m.ball.x, m.ball.z, m.ball.y);
      const radius = 7 + m.ball.y * 2;
      ctx.fillStyle = PALETTE.fg;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.brass;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, radius * 0.55, m.age * 6, m.age * 6 + 1.4);
      ctx.stroke();
    };

    const publish = () => {
      const m = matchRef.current;
      setHud((prev) => {
        if (
          prev.phase === m.phase &&
          prev.you === m.you &&
          prev.house === m.house &&
          prev.message === m.message &&
          prev.server === m.server
        ) {
          return prev;
        }
        return {
          phase: m.phase,
          you: m.you,
          house: m.house,
          message: m.message,
          server: m.server,
        };
      });
      const score = m.you + m.house;
      if (m.phase !== prevPhase) {
        if (m.phase === "point" || m.phase === "done") {
          if (soundRef.current) playCue(m.message === "Fault" || m.message === "Net" || m.message === "Miss" ? "fault" : "score");
        }
        prevPhase = m.phase;
      }
      if (score !== prevScore) prevScore = score;
      if (m.resultReady && !reported.current) {
        reported.current = true;
        const win = m.winner === "player";
        onResultRef.current({
          score: m.you * 10 + (win ? 50 : 0),
          win,
          label: `${m.you}–${m.house}`,
        });
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      stepMatch(matchRef.current, dt);
      publish();
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const m = matchRef.current;
      if (event.code === "ArrowLeft") setShade(m, (m.shade ?? m.px) - 0.18);
      if (event.code === "ArrowRight") setShade(m, (m.shade ?? m.px) + 0.18);
      if (event.code === "Space") {
        event.preventDefault();
        if (soundRef.current) unlockTone();
        const result = playerSwing(m, 0, 1, "top");
        if (result === "sweet" && soundRef.current) playCue("sweet");
        else if (result !== "lock" && result !== "no" && soundRef.current) playCue("hit");
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
        setShade(matchRef.current, null);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const pointFrom = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return toVirtual(clientX - rect.left, clientY - rect.top, rect.width, rect.height, VIEW.w, VIEW.h);
  };

  const swing = (dx: number, dy: number, power: number) => {
    if (soundRef.current) unlockTone();
    let shot: Shot = "top";
    if (dy < -34 && Math.abs(dy) > Math.abs(dx) * 0.85) shot = "lob";
    else if (dy > 28 && Math.abs(dy) > Math.abs(dx) * 0.7) shot = "smash";
    else if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(dy)) shot = "slice";
    const aim = Math.max(-1.1, Math.min(1.1, dx / 80));
    const result = playerSwing(matchRef.current, aim, power, shot);
    if (!soundRef.current) return;
    if (result === "sweet") playCue("sweet");
    else if (result === "serve" || result === "early" || result === "late") playCue("hit");
  };

  return (
    <div className="relative h-full min-h-0 w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none"
        onPointerDown={(event) => {
          if (matchRef.current.phase === "ready" || matchRef.current.phase === "done") return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const p = pointFrom(event.clientX, event.clientY);
          const now = performance.now();
          gesture.current = { x: p.x, y: p.y, t: now, lx: p.x, ly: p.y, lt: now, flicked: false };
          const nx = (p.x - TABLE.x) / TABLE.w * 2 - 1;
          setShade(matchRef.current, nx);
        }}
        onPointerMove={(event) => {
          const g = gesture.current;
          if (!g) return;
          const p = pointFrom(event.clientX, event.clientY);
          const now = performance.now();
          const nx = (p.x - TABLE.x) / TABLE.w * 2 - 1;
          setShade(matchRef.current, nx);
          const dt = now - g.lt;
          if (!g.flicked && dt > 0 && dt < 90) {
            const dx = p.x - g.lx;
            const dy = p.y - g.ly;
            if (Math.hypot(dx, dy) / dt > 0.72) {
              g.flicked = true;
              swing(p.x - g.x, p.y - g.y, Math.min(1.45, 0.8 + Math.hypot(dx, dy) / 40));
            }
          }
          g.lx = p.x;
          g.ly = p.y;
          g.lt = now;
        }}
        onPointerUp={(event) => {
          const g = gesture.current;
          gesture.current = null;
          setShade(matchRef.current, null);
          if (!g || g.flicked) return;
          const p = pointFrom(event.clientX, event.clientY);
          const dx = p.x - g.x;
          const dy = p.y - g.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 22 && performance.now() - g.t < 320) swing(0, -10, 1);
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setShade(matchRef.current, null);
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
        <div className="flex items-center gap-3 rounded-full border border-line bg-surface px-4 py-2">
          <span className="text-xs text-muted">House</span>
          <span className="font-display text-2xl leading-none text-fg tabular-nums">{hud.house}</span>
          <span className="text-muted">–</span>
          <span className="font-display text-2xl leading-none text-brass tabular-nums">{hud.you}</span>
          <span className="max-w-24 truncate text-xs text-muted">{you}</span>
        </div>
      </div>
      {hud.phase === "serve" || hud.phase === "rally" || hud.phase === "point" ? (
        <p className="pointer-events-none absolute inset-x-0 top-16 text-center font-display text-2xl text-brass">
          {hud.message}
        </p>
      ) : null}
      {hud.phase === "rally" || hud.phase === "serve" ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs text-muted">
          {hud.server === "player" && hud.phase === "serve"
            ? "Tap to serve. Flick up to lob, down to smash, sideways to slice."
            : "Slide to place the bat. Flick or tap to swing."}
        </p>
      ) : null}
      {hud.phase === "ready" ? (
        <MatchCard
          kicker="Table tennis"
          title="Ping"
          primary="Start match"
          onPrimary={() => {
            if (sound) unlockTone();
            if (!started.current) {
              started.current = true;
              onPlayRef.current();
            }
            reported.current = false;
            startMatch(matchRef.current);
            playCue("ui");
          }}
        >
          First to 7, win by 2. The bat chases the ball until you put a thumb down.
          Tap for a flat swing. Flick the shot you want.
        </MatchCard>
      ) : null}
      {hud.phase === "done" ? (
        <MatchCard
          kicker={hud.you > hud.house ? "Game" : "House"}
          title={`${hud.you}–${hud.house}`}
          primary="Play again"
          secondary="Back later"
          onSecondary={() => {
            matchRef.current = createMatch();
            setHud({
              phase: "ready",
              you: 0,
              house: 0,
              message: "Tap or flick to swing",
              server: "player",
            });
          }}
          onPrimary={() => {
            if (sound) unlockTone();
            reported.current = false;
            startMatch(matchRef.current);
            playCue("ui");
          }}
        >
          {hud.you > hud.house
            ? "Clean game. The book keeps the score."
            : "House holds the table. One more, if you want it."}
        </MatchCard>
      ) : null}
    </div>
  );
}
