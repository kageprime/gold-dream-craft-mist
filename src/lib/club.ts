import { useEffect, useSyncExternalStore } from "react";

export type GameId = "ping" | "hockey" | "eight" | "slide";

export type Result = {
  score: number;
  win: boolean;
  label: string;
};

export type GameCopy = {
  id: GameId;
  name: string;
  kicker: string;
  line: string;
  unit: string;
  heat: string;
};

export const GAMES: readonly GameCopy[] = [
  {
    id: "ping",
    name: "Ping",
    kicker: "Table tennis",
    line: "Feet chase the ball. You only swing.",
    unit: "pts",
    heat: "to 7",
  },
  {
    id: "hockey",
    name: "Hockey",
    kicker: "Air hockey",
    line: "Drag the mallet. The puck does not wait.",
    unit: "goals",
    heat: "to 5",
  },
  {
    id: "eight",
    name: "Eight",
    kicker: "Pocket pool",
    line: "Pull back, release. Out-pocket the house.",
    unit: "pts",
    heat: "one rack",
  },
  {
    id: "slide",
    name: "Slide",
    kicker: "Shuffleboard",
    line: "Flick the biscuit. Knock theirs off the money.",
    unit: "pts",
    heat: "to 15",
  },
] as const;

export function gameById(id: string): GameCopy | undefined {
  return GAMES.find((game) => game.id === id);
}

type BookEntry = {
  best: number;
  wins: number;
  played: number;
  last: string;
};

export type ClubState = {
  name: string;
  sound: boolean;
  games: Record<GameId, BookEntry>;
};

const KEY = "tables.club.v1";

function emptyEntry(): BookEntry {
  return { best: 0, wins: 0, played: 0, last: "" };
}

function fresh(): ClubState {
  return {
    name: "Guest",
    sound: true,
    games: {
      ping: emptyEntry(),
      hockey: emptyEntry(),
      eight: emptyEntry(),
      slide: emptyEntry(),
    },
  };
}

function sanitize(raw: unknown): ClubState {
  const base = fresh();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Partial<ClubState>;
  if (typeof data.name === "string" && data.name.trim()) {
    base.name = data.name.trim().slice(0, 16);
  }
  if (typeof data.sound === "boolean") base.sound = data.sound;
  if (data.games && typeof data.games === "object") {
    for (const game of GAMES) {
      const entry = data.games[game.id];
      if (!entry || typeof entry !== "object") continue;
      base.games[game.id] = {
        best: Number.isFinite(entry.best) ? Math.max(0, entry.best) : 0,
        wins: Number.isFinite(entry.wins) ? Math.max(0, entry.wins) : 0,
        played: Number.isFinite(entry.played) ? Math.max(0, entry.played) : 0,
        last: typeof entry.last === "string" ? entry.last.slice(0, 48) : "",
      };
    }
  }
  return base;
}

let state: ClubState = fresh();
const serverState: ClubState = fresh();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

export function hydrateClub() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    state = sanitize(JSON.parse(raw));
    emit();
  } catch {
    /* ignore broken book */
  }
}

export function setClubName(name: string) {
  state = { ...state, name: name.trim().slice(0, 16) || "Guest" };
  emit();
  persist();
}

export function setClubSound(sound: boolean) {
  state = { ...state, sound };
  emit();
  persist();
}

export function markPlayed(id: GameId) {
  const entry = state.games[id];
  state = {
    ...state,
    games: {
      ...state.games,
      [id]: { ...entry, played: entry.played + 1 },
    },
  };
  emit();
  persist();
}

export function recordResult(id: GameId, result: Result) {
  const entry = state.games[id];
  state = {
    ...state,
    games: {
      ...state.games,
      [id]: {
        ...entry,
        best: Math.max(entry.best, result.score),
        wins: entry.wins + (result.win ? 1 : 0),
        last: result.label,
      },
    },
  };
  emit();
  persist();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useClub() {
  return useSyncExternalStore(subscribe, () => state, () => serverState);
}

export function useClubHydrate() {
  useEffect(() => {
    hydrateClub();
  }, []);
}
