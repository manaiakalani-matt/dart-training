import { readFile, writeFile } from "node:fs/promises";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  throw new Error("Usage: node scripts/build-import.mjs input.csv output.sql");
}

const text = await readFile(inputPath, "utf8");
const rows = parseCsv(text);
const expectedHeaders = [
  "Attempt_ID", "Session_ID", "Submitted_At_UTC", "Training_Date", "Time_Zone",
  "Player_ID", "Player_Name", "Routine_ID", "Routine_Version", "Category", "Status",
  "Score", "Hits", "Possible", "Time_Seconds", "Progress_Value", "Rounds_Played",
  "Detail_1", "Detail_2", "Detail_3", "Detail_4", "Result_Display", "Notes",
  "Device_ID", "Source", "Client_Version",
];

if (JSON.stringify(rows[0]) !== JSON.stringify(expectedHeaders)) {
  throw new Error("The source CSV headers do not match the expected Training_Log schema.");
}

const numericColumns = new Set([8, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
const columns = [
  "attempt_id", "session_id", "submitted_at_utc", "training_date", "time_zone",
  "player_id", "player_name", "routine_id", "routine_version", "category", "status",
  "score", "hits", "possible", "time_seconds", "progress_value", "rounds_played",
  "detail_1", "detail_2", "detail_3", "detail_4", "result_display", "notes",
  "device_id", "source", "client_version",
];

const statements = rows.slice(1).filter((row) => row.some(Boolean)).map((row, rowIndex) => {
  if (row.length !== columns.length) {
    throw new Error(`CSV row ${rowIndex + 2} has ${row.length} columns; expected ${columns.length}.`);
  }
  const values = row.map((value, index) => sqlValue(value, numericColumns.has(index)));
  return `INSERT OR IGNORE INTO training_log (${columns.join(", ")}) VALUES (${values.join(", ")});`;
});

await writeFile(
  outputPath,
  `-- One-time import from the previous Google Sheet backend.\n${statements.join("\n")}\n`,
  "utf8",
);

console.log(`Prepared ${statements.length} existing Darty Practice results for migration.`);

function sqlValue(value, numeric) {
  if (value === "" && numeric) return "NULL";
  if (numeric) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`Invalid numeric value: ${value}`);
    return String(number);
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}
