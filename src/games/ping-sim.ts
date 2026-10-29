export type Side = "player" | "ai";
export type Shot = "top" | "slice" | "lob" | "smash";
export type Phase = "ready" | "serve" | "rally" | "point" | "done";

export type PingBall = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
};

export type Match = {
  phase: Phase;
  ball: PingBall;
  px: number;
  ax: number;
  shade: number | null;
  server: Side;
  you: number;
  house: number;
  message: string;
  banner: string;
  timer: number;
  lastHitter: Side | null;
  bounces: number;
  ownBounce: boolean;
  recvBounce: number;
  serveLeg: boolean;
  lock: number;
  aiArmed: boolean;
  aiWait: number;
  dead: number;
  rally: number;
  age: number;
  resultReady: boolean;
  winner: Side | null;
};

const G = 6.6;
const HALF_G = G * 0.5;
const REST = 0.88;
const NET = 0.16;
const TW = 0.86;
const TZ = 1;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function other(side: Side): Side {
  return side === "player" ? "ai" : "player";
}

export function createMatch(): Match {
  const match: Match = {
    phase: "ready",
    ball: { x: 0, y: 0.35, z: 0.15, vx: 0.35, vy: 1.4, vz: 0.2, spin: 0 },
    px: 0,
    ax: 0,
    shade: null,
    server: "player",
    you: 0,
    house: 0,
    message: "Tap or flick to swing",
    banner: "",
    timer: 0,
    lastHitter: null,
    bounces: 0,
    ownBounce: false,
    recvBounce: 0,
    serveLeg: false,
    lock: 0,
    aiArmed: false,
    aiWait: 0,
    dead: 0,
    rally: 0,
    age: 0,
    resultReady: false,
    winner: null,
  };
  return match;
}

export function startMatch(m: Match) {
  m.you = 0;
  m.house = 0;
  m.server = "player";
  m.winner = null;
  m.resultReady = false;
  m.rally = 0;
  beginServe(m);
}

function holdBall(m: Match) {
  const side = m.server;
  const paddle = side === "player" ? m.px : m.ax;
  m.ball.x = paddle * 0.35;
  m.ball.y = 0.3 + Math.sin(m.age * 3) * 0.015;
  m.ball.z = side === "player" ? 0.74 : -0.74;
  m.ball.vx = 0;
  m.ball.vy = 0;
  m.ball.vz = 0;
  m.ball.spin = 0;
}

function beginServe(m: Match) {
  const total = m.you + m.house;
  const deuce = m.you >= 6 && m.house >= 6;
  const flips = deuce ? total : Math.floor(total / 2);
  m.server = flips % 2 === 0 ? "player" : "ai";
  m.phase = "serve";
  m.serveLeg = true;
  m.ownBounce = false;
  m.bounces = 0;
  m.recvBounce = 0;
  m.lastHitter = null;
  m.dead = 0;
  m.aiArmed = false;
  m.aiWait = 0.7 + Math.random() * 0.45;
  m.lock = 0;
  m.banner = "";
  m.message = m.server === "player" ? "Your serve" : "House serve";
  holdBall(m);
}

function isOver(you: number, house: number) {
  const max = Math.max(you, house);
  return (max >= 7 && Math.abs(you - house) >= 2) || max >= 11;
}

function award(m: Match, winner: Side, reason: string) {
  if (m.phase === "point" || m.phase === "done" || m.phase === "ready") return;
  if (winner === "player") m.you += 1;
  else m.house += 1;
  m.message = reason;
  m.banner = reason;
  m.ball.vx = 0;
  m.ball.vy = 0;
  m.ball.vz = 0;
  if (isOver(m.you, m.house)) {
    m.phase = "done";
    m.winner = m.you === m.house ? null : m.you > m.house ? "player" : "ai";
    if (m.you !== m.house) m.winner = m.you > m.house ? "player" : "ai";
    m.resultReady = true;
    m.message = m.winner === "player" ? "Game" : "House takes it";
    return;
  }
  m.phase = "point";
  m.timer = 1.05;
}

function redoServe(m: Match, reason: string) {
  if (m.phase === "point" || m.phase === "done" || m.phase === "ready") return;
  m.message = reason;
  m.banner = reason;
  m.phase = "point";
  m.timer = 0.85;
  m.ball.vx = 0;
  m.ball.vy = 0;
  m.ball.vz = 0;
  m.serveLeg = true;
}

function onTable(x: number, z: number) {
  return Math.abs(x) <= TW && Math.abs(z) <= TZ;
}

function planStrike(fromZ: number, fromY: number, landZ: number, flight0: number) {
  let flight = flight0;
  let planned = { vz: 0, vy: 1, y0: 0.2, yNet: 0, flight };
  for (let k = 0; k < 7; k += 1) {
    const vz = (landZ - fromZ) / flight;
    const y0 = clamp(fromY, 0.12, 0.42);
    const vy = (HALF_G * flight * flight - y0) / flight;
    const tNet = Math.abs(fromZ) / Math.max(0.08, Math.abs(vz));
    const yNet = y0 + vy * tNet - HALF_G * tNet * tNet;
    planned = { vz, vy, y0, yNet, flight };
    if (yNet >= NET + 0.07 && tNet < flight * 0.92 && vy > 0.2) break;
    flight += 0.08;
  }
  return planned;
}

function launch(m: Match, side: Side, aim: number, power: number, shot: Shot, serve: boolean) {
  const dir = side === "player" ? -1 : 1;
  const paced = clamp(power, 0.75, 1.55);
  if (serve) {
    m.ball.z = side === "player" ? 0.34 : -0.34;
    m.ball.x = side === "player" ? m.px : m.ax;
    m.ball.y = 0.08;
    m.ball.vy = 2.2;
    m.ball.vz = dir * (1.42 + paced * 0.2);
    m.ball.vx = aim * 0.48;
    m.ball.spin = aim * 0.25;
    m.ownBounce = true;
    m.bounces = 1;
    m.recvBounce = 0;
    m.serveLeg = true;
    m.message = "Serve";
  } else {
    const dirLand = dir;
    let depth = 0.62;
    if (shot === "lob") depth = 0.4;
    if (shot === "smash") depth = 0.76;
    if (m.banner === "Early") depth = 0.18;
    if (m.banner === "Late") depth = 1.08;
    if (side === "ai") depth += (Math.random() - 0.5) * 0.1;
    if (side === "ai" && Math.random() < 0.16) depth = 1.12 + Math.random() * 0.18;
    let landZ = dirLand * depth;
    const fromZ = clamp(m.ball.z, -0.92, 0.92);
    if (Math.sign(landZ) === Math.sign(fromZ) && Math.abs(depth) < 1) {
      landZ = dirLand * 0.62;
    }
    const flight = shot === "smash" ? 0.5 : shot === "lob" ? 0.84 : 0.6;
    const planned = planStrike(fromZ, Math.max(m.ball.y, 0.14), landZ, flight);
    m.ball.y = planned.y0;
    m.ball.vy = planned.vy;
    m.ball.vz = planned.vz;
    m.ball.vx = clamp(aim, -1.2, 1.2) * (shot === "slice" ? 0.7 : 0.5);
    m.ball.spin = shot === "slice" ? aim * 1.4 : shot === "top" ? dir * -0.35 : 0;
    m.ownBounce = false;
    m.bounces = 0;
    m.recvBounce = 0;
    m.serveLeg = false;
    m.message = m.banner === "Sweet" || m.banner === "House" ? shotLabel(shot) : m.banner || shotLabel(shot);
  }
  m.lastHitter = side;
  m.phase = "rally";
  m.dead = 0;
  m.lock = 0.18;
  if (!serve) m.rally += 1;
}

export function playerSwing(m: Match, aim: number, power: number, shot: Shot): string {
  if (m.lock > 0) return "lock";
  if (m.phase === "serve" && m.server === "player") {
    m.banner = "Serve";
    launch(m, "player", clamp(aim, -1, 1), clamp(power, 0.75, 1.5), shot, true);
    return "serve";
  }
  if (m.phase !== "rally") return "no";
  if (m.lastHitter === "player") return "soon";
  const ball = m.ball;
  const xOk = Math.abs(ball.x - m.px) < 0.36;
  const zOk = ball.z > 0.4 && ball.z < 0.98;
  const yOk = ball.y < 0.85;
  const incoming = ball.vz > -0.2;
  if (!(m.bounces >= 1 && zOk && yOk && incoming)) {
    m.banner = "Early";
    m.message = "Early";
    return "early";
  }
  if (!xOk) {
    m.banner = "Wide";
    m.message = "Wide of the bat";
    return "wide";
  }
  const delta = ball.z - 0.7;
  if (delta < -0.12) m.banner = "Early";
  else if (delta > 0.14) m.banner = "Late";
  else m.banner = "Sweet";
  launch(m, "player", clamp(aim, -1.2, 1.2), clamp(power, 0.7, 1.6), shot, false);
  return m.banner.toLowerCase();
}

function shotLabel(shot: Shot) {
  if (shot === "slice") return "Slice";
  if (shot === "lob") return "Lob";
  if (shot === "smash") return "Smash";
  return "Topspin";
}

function canAiHit(m: Match) {
  if (m.phase !== "rally" || m.lastHitter === "ai" || m.bounces < 1) return false;
  const ball = m.ball;
  return (
    ball.z < -0.42 &&
    ball.z > -0.98 &&
    ball.y < 0.8 &&
    ball.vz < 0.15 &&
    Math.abs(ball.x - m.ax) < 0.38
  );
}

function aiShotChoice(m: Match): { aim: number; power: number; shot: Shot } {
  const roll = Math.random();
  const wide = m.px > 0 ? -1 : 1;
  if (roll < 0.12) return { aim: 0, power: 1, shot: "smash" };
  if (roll < 0.22) return { aim: wide * 0.35, power: 0.9, shot: "lob" };
  if (roll < 0.48) return { aim: wide * (0.85 + Math.random() * 0.4), power: 1, shot: "slice" };
  return { aim: wide * (0.25 + Math.random() * 0.35), power: 1, shot: "top" };
}

function track(current: number, target: number, speed: number, dt: number) {
  const delta = target - current;
  const max = speed * dt;
  if (Math.abs(delta) <= max) return target;
  return current + Math.sign(delta) * max;
}

function integrate(m: Match, dt: number) {
  if (m.phase !== "rally") return;
  const ball = m.ball;
  const prevX = ball.x;
  const prevY = ball.y;
  const prevZ = ball.z;
  ball.vy -= G * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.z += ball.vz * dt;
  ball.vx += ball.spin * dt * 0.45;

  if ((prevZ > 0 && ball.z <= 0) || (prevZ < 0 && ball.z >= 0)) {
    const span = prevZ - ball.z || 0.0001;
    const t = prevZ / span;
    const yCross = prevY + (ball.y - prevY) * t;
    const xCross = prevX + (ball.x - prevX) * t;
    if (m.serveLeg && !m.ownBounce) {
      award(m, other(m.server), "Fault");
      return;
    }
    if (yCross < NET && Math.abs(xCross) < TW + 0.05) {
      if (m.serveLeg) redoServe(m, "Let");
      else if (m.lastHitter) award(m, other(m.lastHitter), "Net");
      return;
    }
  }

  if (ball.y <= 0) {
    if (onTable(ball.x, ball.z)) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy) * REST;
      ball.vx += ball.spin * 0.12;
      ball.spin *= 0.62;
      const side: Side = ball.z >= 0 ? "player" : "ai";
      m.bounces += 1;
      if (!m.lastHitter) return;
      if (m.serveLeg) {
        if (!m.ownBounce) {
          if (side !== m.server) {
            award(m, other(m.server), "Fault");
            return;
          }
          m.ownBounce = true;
          return;
        }
        if (side === m.server) {
          award(m, other(m.server), "Fault");
          return;
        }
        m.serveLeg = false;
        m.bounces = 1;
        m.recvBounce = 1;
        return;
      }
      if (side === m.lastHitter) {
        award(m, other(m.lastHitter), "Not over");
        return;
      }
      m.recvBounce += 1;
      if (m.recvBounce >= 2) {
        award(m, m.lastHitter, m.lastHitter === "player" ? "Winner" : "Miss");
      }
      return;
    }
    ball.y = 0;
    ball.vy = 0;
    ball.vx *= 0.2;
    ball.vz *= 0.2;
    if (!m.lastHitter) return;
    if (m.serveLeg) {
      award(m, other(m.server), "Fault");
      return;
    }
    if (m.recvBounce >= 1) {
      award(m, m.lastHitter, m.lastHitter === "player" ? "Winner" : "Miss");
      return;
    }
    const reason = Math.abs(ball.x) > TW ? "Wide" : "Long";
    award(m, other(m.lastHitter), reason);
  }
}

export function stepMatch(m: Match, dt: number) {
  m.age += dt;
  m.lock = Math.max(0, m.lock - dt);
  if (m.phase === "ready") {
    m.ball.vy -= G * dt;
    m.ball.y += m.ball.vy * dt;
    m.ball.x += m.ball.vx * dt;
    m.ball.z += m.ball.vz * dt;
    if (m.ball.y <= 0 && Math.abs(m.ball.x) < TW && Math.abs(m.ball.z) < TZ) {
      m.ball.y = 0;
      m.ball.vy = Math.abs(m.ball.vy) * 0.8;
    }
    if (Math.abs(m.ball.x) > 0.7) m.ball.vx *= -1;
    if (Math.abs(m.ball.z) > 0.8) m.ball.vz *= -1;
    return;
  }
  if (m.phase === "point") {
    m.timer -= dt;
    if (m.timer <= 0) beginServe(m);
    return;
  }
  if (m.phase === "done") return;

  const auto = clamp(m.ball.x, -0.72, 0.72);
  const playerTarget = m.shade == null ? auto : clamp(m.shade, -0.8, 0.8);
  m.px = track(m.px, playerTarget, m.shade == null ? 1.45 : 3.4, dt);
  const aiTarget = clamp(m.ball.x + (m.ball.vx || 0) * 0.08, -0.72, 0.72);
  m.ax = track(m.ax, m.phase === "serve" ? 0 : aiTarget, 1.7, dt);

  if (m.phase === "serve") {
    holdBall(m);
    if (m.server === "ai") {
      m.aiWait -= dt;
      if (m.aiWait <= 0) {
        const aim = (Math.random() - 0.5) * 0.5;
        m.banner = "Serve";
        launch(m, "ai", aim, 1, "top", true);
      }
    }
    return;
  }

  const slices = 5;
  const h = dt / slices;
  for (let i = 0; i < slices; i += 1) {
    integrate(m, h);
    if (m.phase !== "rally") return;
  }

  const speed = Math.hypot(m.ball.vx, m.ball.vy, m.ball.vz);
  if (speed < 0.35 && m.ball.y < 0.04) m.dead += dt;
  else m.dead = 0;
  if (m.dead > 1.15 && m.lastHitter) {
    award(m, other(m.lastHitter), "Dead");
    return;
  }

  if (canAiHit(m)) {
    if (!m.aiArmed) {
      m.aiArmed = true;
      m.aiWait = 0.07 + Math.random() * 0.08;
    }
    m.aiWait -= dt;
    if (m.aiWait <= 0) {
      const choice = aiShotChoice(m);
      const noise = (Math.random() - 0.5) * 0.18;
      m.banner = "House";
      launch(m, "ai", choice.aim + noise, choice.power, choice.shot, false);
      m.aiArmed = false;
    }
  } else {
    m.aiArmed = false;
  }
}

export function setShade(m: Match, x: number | null) {
  m.shade = x;
}

export const TABLE = { x: 40, y: 86, w: 310, h: 520 };
export const VIEW = { w: 390, h: 700 };

export function worldToScreen(x: number, z: number, y = 0) {
  const sx = TABLE.x + ((x + 1) / 2) * TABLE.w;
  const sy = TABLE.y + ((1 - z) / 2) * TABLE.h - y * 86;
  return { x: sx, y: sy };
}
