type InputDefinition = {
  key: string;
  label: string;
  min?: number;
  max?: number;
};

type RoutineDefinition = {
  routineId: string;
  version: number;
  category: string;
  routineName: string;
  allowedStatuses: string[];
  inputs: InputDefinition[];
};

type AttemptInput = {
  attemptId?: unknown;
  routineId?: unknown;
  status?: unknown;
  values?: unknown;
  resultDisplay?: unknown;
  notes?: unknown;
};

type SaveSessionBody = {
  action?: unknown;
  sessionId?: unknown;
  playerId?: unknown;
  trainingDate?: unknown;
  timeZone?: unknown;
  deviceId?: unknown;
  clientVersion?: unknown;
  attempts?: unknown;
};

type CalculatedResult = {
  score: number | null;
  hits: number | null;
  possible: number | null;
  timeSeconds: number | null;
  progressValue: number | null;
  roundsPlayed: number | null;
  display: string;
};

type PreparedAttempt = CalculatedResult & {
  attemptId: string;
  routineId: string;
  version: number;
  category: string;
  status: string;
  details: Array<number | null>;
  resultDisplay: string;
  notes: string;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const ROUTINES: Record<string, RoutineDefinition> = {
  "twelve-dart-targets": routine("twelve-dart-targets", "Scoring", "12-Dart Targets", [
    input("score_20", "Score at 20", 0, 720),
    input("score_19", "Score at 19", 0, 684),
    input("score_18", "Score at 18", 0, 648),
    input("score_bull", "Score at Bull", 0, 600),
  ]),
  "around-clock-singles": routine("around-clock-singles", "Scoring", "Around the Clock Singles", [
    input("time_seconds", "Completion time", 1),
  ]),
  "straight-20-19": routine("straight-20-19", "Scoring", "Straight 20s & 19s", [
    input("best_20", "Best run on 20", 0),
    input("best_19", "Best run on 19", 0),
  ]),
  "24-dart-high-score": routine("24-dart-high-score", "Scoring", "24-Dart High Score", [
    input("round_1", "Round 1 score", 0, 1440),
    input("round_2", "Round 2 score", 0, 1440),
    input("round_3", "Round 3 score", 0, 1440),
  ]),
  "cricket-scoring": routine("cricket-scoring", "Scoring", "Cricket Scoring", [
    input("score", "Marks out of 60", 0, 60),
  ]),
  "round-board-hits": routine("round-board-hits", "Scoring", "Round-the-Board Hits", [
    input("score", "Marks out of 180", 0, 180),
  ]),
  "around-clock-doubles": routine("around-clock-doubles", "Doubles", "Around the Clock Doubles", [
    input("time_seconds", "Elapsed time", 0, 1200),
    input("progress_value", "Last target reached", 1, 21),
  ], ["COMPLETE", "TIMEOUT", "ABANDONED"]),
  "one-at-double": routine("one-at-double", "Doubles", "One at the Double", [
    input("hits", "Hits out of 63", 0, 63),
  ]),
  "bobs-27": routine("bobs-27", "Doubles", "Bob's 27", [
    input("score", "Final score"),
    input("progress_value", "Last target reached", 1, 21),
  ], ["COMPLETE", "LOSS", "ABANDONED"]),
  "favourite-doubles": routine("favourite-doubles", "Doubles", "Favourite Doubles", [
    input("hits_d20", "Hits at D20", 0, 12),
    input("hits_d16", "Hits at D16", 0, 12),
    input("hits_d10", "Hits at D10", 0, 12),
    input("hits_d8", "Hits at D8", 0, 12),
  ]),
  "eight-of-32-40": routine("eight-of-32-40", "Doubles", "8 of 32 & 40", [
    input("checkouts_32", "32 checkouts made", 0, 8),
    input("checkouts_40", "40 checkouts made", 0, 8),
  ]),
  "41-and-up": routine("41-and-up", "Checkouts", "41 and Up", [
    input("progress_value", "Highest checkout completed", 40, 60),
  ], ["COMPLETE", "LOSS", "ABANDONED"]),
  "checkout-bounce": routine("checkout-bounce", "Checkouts", "Checkout Bounce", [
    input("progress_value", "Final checkout", 80, 120),
    input("time_seconds", "Elapsed time", 0, 1200),
  ], ["WIN", "LOSS", "TIMEOUT", "ABANDONED"]),
  "checkout-golf": routine("checkout-golf", "Checkouts", "Checkout Golf", [
    input("score", "Total darts", 18, 126),
  ]),
  "club-checkouts": routine("club-checkouts", "Checkouts", "Club Checkouts 18–30", [
    input("score", "Points out of 39", 0, 39),
  ]),
  "killer-checkouts": routine("killer-checkouts", "Checkouts", "Killer Checkouts", [
    input("final_lives", "Final lives", 0, 12),
    input("rounds_played", "Rounds played", 1),
  ], ["WIN", "LOSS", "ABANDONED"]),
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      const url = new URL(request.url);
      if (request.method === "GET") {
        return await handleGet(url, env);
      }
      if (request.method === "POST") {
        return await handlePost(request, env);
      }
      return json({ ok: false, error: "Method not allowed." }, 405);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected service error.";
      console.error(JSON.stringify({ event: "request_failed", message, stack: error instanceof Error ? error.stack : undefined }));
      return json({ ok: false, error: message }, 400);
    }
  },
} satisfies ExportedHandler<Env>;

async function handleGet(url: URL, env: Env): Promise<Response> {
  const action = cleanText(url.searchParams.get("action")) || "health";

  if (action === "health") {
    return json({ ok: true, service: "Darty Practice API", version: "2.0.0" });
  }

  if (action === "players") {
    const result = await env.DB.prepare(
      "SELECT player_id AS playerId, display_name AS displayName, sort_order AS sortOrder FROM players WHERE active = 1 ORDER BY sort_order, display_name",
    ).all();
    return json({ ok: true, players: result.results });
  }

  if (action === "routines") {
    const routines = Object.values(ROUTINES).map((definition) => ({
      ...definition,
      allowedStatuses: definition.allowedStatuses.join("|"),
    }));
    return json({ ok: true, routines });
  }

  if (action === "results") {
    const playerId = cleanText(url.searchParams.get("playerId"));
    if (!/^\d{1,20}$/.test(playerId)) {
      throw new Error("A valid Player ID is required.");
    }
    const result = await env.DB.prepare(`
      SELECT
        attempt_id AS "Attempt_ID", session_id AS "Session_ID",
        submitted_at_utc AS "Submitted_At_UTC", training_date AS "Training_Date",
        time_zone AS "Time_Zone", player_id AS "Player_ID", player_name AS "Player_Name",
        routine_id AS "Routine_ID", routine_version AS "Routine_Version", category AS "Category",
        status AS "Status", score AS "Score", hits AS "Hits", possible AS "Possible",
        time_seconds AS "Time_Seconds", progress_value AS "Progress_Value",
        rounds_played AS "Rounds_Played", detail_1 AS "Detail_1", detail_2 AS "Detail_2",
        detail_3 AS "Detail_3", detail_4 AS "Detail_4", result_display AS "Result_Display",
        notes AS "Notes", device_id AS "Device_ID", source AS "Source", client_version AS "Client_Version"
      FROM training_log
      WHERE player_id = ?
      ORDER BY submitted_at_utc, attempt_id
      LIMIT 5000
    `).bind(playerId).all();
    return json({ ok: true, results: result.results });
  }

  throw new Error("Unknown action.");
}

async function handlePost(request: Request, env: Env): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 131072) {
    throw new Error("Request body is too large.");
  }

  const raw = await request.text();
  if (!raw || raw.length > 131072) {
    throw new Error(raw ? "Request body is too large." : "Request body is empty.");
  }

  let body: SaveSessionBody;
  try {
    body = JSON.parse(raw) as SaveSessionBody;
  } catch {
    throw new Error("Request body is not valid JSON.");
  }

  if (body.action !== "saveSession") {
    throw new Error("Unknown action.");
  }
  return saveSession(body, env);
}

async function saveSession(body: SaveSessionBody, env: Env): Promise<Response> {
  const sessionId = cleanId(body.sessionId);
  const playerId = cleanText(body.playerId);
  const trainingDate = cleanDate(body.trainingDate);
  const timeZone = cleanText(body.timeZone) || "Pacific/Auckland";
  const deviceId = cleanText(body.deviceId).slice(0, 100);
  const clientVersion = (cleanText(body.clientVersion) || "unknown").slice(0, 40);

  if (!sessionId) throw new Error("Session ID is required.");
  if (!/^\d{1,20}$/.test(playerId)) throw new Error("Player ID is required.");
  if (!trainingDate) throw new Error("A valid training date is required.");
  if (!Array.isArray(body.attempts) || body.attempts.length === 0) {
    throw new Error("At least one routine result is required.");
  }
  if (body.attempts.length > 30) throw new Error("Too many routine results in one session.");

  const player = await env.DB.prepare(
    "SELECT player_id AS playerId, display_name AS displayName FROM players WHERE player_id = ? AND active = 1",
  ).bind(playerId).first<{ playerId: string; displayName: string }>();
  if (!player) throw new Error("Player is not active in Darty Practice.");

  const seen = new Set<string>();
  const prepared = body.attempts.map((attempt) => {
    if (!isObject(attempt)) throw new Error("Every result must be an object.");
    const item = prepareAttempt(attempt as AttemptInput);
    if (seen.has(item.attemptId)) throw new Error("Duplicate Attempt ID in submission.");
    seen.add(item.attemptId);
    return item;
  });

  const placeholders = prepared.map(() => "?").join(",");
  const existingResult = await env.DB.prepare(
    `SELECT attempt_id AS attemptId, session_id AS sessionId, player_id AS playerId
     FROM training_log WHERE attempt_id IN (${placeholders})`,
  ).bind(...prepared.map((item) => item.attemptId)).all<{ attemptId: string; sessionId: string; playerId: string }>();
  const conflicting = existingResult.results.find((row) => row.sessionId !== sessionId || row.playerId !== playerId);
  if (conflicting) throw new Error("An Attempt ID is already attached to another training session.");
  const existing = new Set(existingResult.results.map((row) => row.attemptId));
  const pending = prepared.filter((item) => !existing.has(item.attemptId));
  const submittedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  let saved = 0;
  if (pending.length > 0) {
    const statements = pending.map((item) => env.DB.prepare(`
      INSERT OR IGNORE INTO training_log (
        attempt_id, session_id, submitted_at_utc, training_date, time_zone,
        player_id, player_name, routine_id, routine_version, category, status,
        score, hits, possible, time_seconds, progress_value, rounds_played,
        detail_1, detail_2, detail_3, detail_4, result_display, notes,
        device_id, source, client_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      item.attemptId, sessionId, submittedAt, trainingDate, timeZone,
      player.playerId, player.displayName, item.routineId, item.version, item.category, item.status,
      item.score, item.hits, item.possible, item.timeSeconds, item.progressValue, item.roundsPlayed,
      item.details[0], item.details[1], item.details[2], item.details[3], item.resultDisplay, item.notes,
      deviceId, "Darty Practice Web", clientVersion,
    ));
    const results = await env.DB.batch(statements);
    saved = results.reduce((total, result) => total + Number(result.meta.changes || 0), 0);
  }

  const acceptedResult = await env.DB.prepare(
    `SELECT attempt_id AS attemptId FROM training_log
     WHERE session_id = ? AND player_id = ? AND attempt_id IN (${placeholders})`,
  ).bind(sessionId, playerId, ...prepared.map((item) => item.attemptId)).all<{ attemptId: string }>();

  return json({
    ok: true,
    sessionId,
    saved,
    accepted: acceptedResult.results.map((row) => row.attemptId),
    duplicates: prepared.filter((item) => existing.has(item.attemptId)).map((item) => item.attemptId),
  });
}

function prepareAttempt(attempt: AttemptInput): PreparedAttempt {
  const attemptId = cleanId(attempt.attemptId);
  const routineId = cleanId(attempt.routineId);
  const definition = ROUTINES[routineId];
  const status = cleanText(attempt.status).toUpperCase();
  const values = isObject(attempt.values) ? attempt.values : {};

  if (!attemptId) throw new Error("Every result requires an Attempt ID.");
  if (!definition) throw new Error(`Unknown or inactive routine: ${routineId}`);
  if (!definition.allowedStatuses.includes(status)) {
    throw new Error(`Invalid status for ${definition.routineName}.`);
  }

  const numeric: Record<string, number> = {};
  const details: Array<number | null> = [null, null, null, null];
  definition.inputs.forEach((field, index) => {
    const raw = values[field.key];
    if (raw === "" || raw === null || raw === undefined) {
      if (status !== "ABANDONED") throw new Error(`${field.label} is required for ${definition.routineName}.`);
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`${field.label} must be a number.`);
    if (field.min !== undefined && value < field.min) throw new Error(`${field.label} is below its minimum.`);
    if (field.max !== undefined && value > field.max) throw new Error(`${field.label} is above its maximum.`);
    numeric[field.key] = value;
    details[index] = value;
  });

  const calculated = calculateResult(routineId, status, numeric);
  return {
    attemptId,
    routineId,
    version: definition.version,
    category: definition.category,
    status,
    details,
    resultDisplay: (cleanText(attempt.resultDisplay) || calculated.display).slice(0, 200),
    notes: cleanText(attempt.notes).slice(0, 500),
    ...calculated,
  };
}

function calculateResult(id: string, status: string, v: Record<string, number>): CalculatedResult {
  const result: CalculatedResult = {
    score: null, hits: null, possible: null, timeSeconds: null,
    progressValue: null, roundsPlayed: null, display: "",
  };

  if (status === "ABANDONED") {
    result.display = "Abandoned";
    return result;
  }

  if (id === "twelve-dart-targets") {
    result.score = v.score_20 + v.score_19 + v.score_18 + v.score_bull;
    result.display = `${result.score} points`;
  } else if (id === "around-clock-singles") {
    result.timeSeconds = v.time_seconds;
    result.display = formatSeconds(v.time_seconds);
  } else if (id === "straight-20-19") {
    result.score = v.best_20 + v.best_19;
    result.display = `20s: ${v.best_20} | 19s: ${v.best_19}`;
  } else if (id === "24-dart-high-score") {
    result.score = [v.round_1, v.round_2, v.round_3].sort((a, b) => a - b)[1];
    result.display = `Median ${result.score}`;
  } else if (id === "cricket-scoring") {
    result.score = v.score; result.possible = 60; result.display = `${v.score}/60 marks`;
  } else if (id === "round-board-hits") {
    result.score = v.score; result.possible = 180; result.display = `${v.score}/180 marks`;
  } else if (id === "around-clock-doubles") {
    result.timeSeconds = v.time_seconds; result.progressValue = v.progress_value;
    result.display = status === "COMPLETE" ? formatSeconds(v.time_seconds) : `Reached target ${v.progress_value}`;
  } else if (id === "one-at-double") {
    result.hits = v.hits; result.possible = 63; result.display = `${v.hits}/63 hits`;
  } else if (id === "bobs-27") {
    result.score = v.score; result.progressValue = v.progress_value;
    result.display = `${v.score} points at target ${v.progress_value}`;
  } else if (id === "favourite-doubles") {
    result.hits = v.hits_d20 + v.hits_d16 + v.hits_d10 + v.hits_d8;
    result.possible = 48; result.display = `${result.hits}/48 hits`;
  } else if (id === "eight-of-32-40") {
    result.hits = v.checkouts_32 + v.checkouts_40;
    result.possible = 16; result.display = `${result.hits}/16 checkouts`;
  } else if (id === "41-and-up") {
    result.progressValue = v.progress_value; result.display = `Completed through ${v.progress_value}`;
  } else if (id === "checkout-bounce") {
    result.progressValue = v.progress_value; result.timeSeconds = v.time_seconds;
    result.display = `${status} at ${v.progress_value}`;
  } else if (id === "checkout-golf") {
    result.score = v.score; result.possible = 73; result.display = `${v.score} darts`;
  } else if (id === "club-checkouts") {
    result.score = v.score; result.possible = 39; result.display = `${v.score}/39 points`;
  } else if (id === "killer-checkouts") {
    result.progressValue = v.final_lives; result.roundsPlayed = v.rounds_played;
    result.display = `${status} with ${v.final_lives} lives after ${v.rounds_played} rounds`;
  }
  return result;
}

function routine(
  routineId: string,
  category: string,
  routineName: string,
  inputs: InputDefinition[],
  allowedStatuses: string[] = ["COMPLETE", "ABANDONED"],
): RoutineDefinition {
  return { routineId, version: 1, category, routineName, allowedStatuses, inputs };
}

function input(key: string, label: string, min?: number, max?: number): InputDefinition {
  return { key, label, min, max };
}

function cleanText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function cleanId(value: unknown): string {
  const id = cleanText(value);
  return /^[A-Za-z0-9_-]{6,100}$/.test(id) ? id : "";
}

function cleanDate(value: unknown): string {
  const date = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${remainder < 10 ? "0" : ""}${remainder}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
