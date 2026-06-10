#!/usr/bin/env node
'use strict';

/**
 * Planer für Kurs- und Erweiterungskurstage.
 *
 * Aufruf:
 *   node plan-course.js 12.12.2026
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// -----------------------------------------------------------------------------
// Kursdaten: am Anfang des Skripts definiert
// -----------------------------------------------------------------------------
const courseDays = [
  { course: 'Kurs', title: 'Einführung', startTime: '09:00', durationMinutes: 90 },
  { course: 'Kurs', title: 'Grundlagen I', startTime: '09:00', durationMinutes: 90 },
  { course: 'Kurs', title: 'Grundlagen II', startTime: '09:00', durationMinutes: 90 },
  { course: 'Kurs', title: 'Übung I', startTime: '09:00', durationMinutes: 90 },
  { course: 'Kurs', title: 'Übung II', startTime: '09:00', durationMinutes: 90 },
  { course: 'Kurs', title: 'Vertiefung I', startTime: '09:00', durationMinutes: 90 },
  { course: 'Kurs', title: 'Vertiefung II', startTime: '09:00', durationMinutes: 90 },
  { course: 'Kurs', title: 'Praxis I', startTime: '09:00', durationMinutes: 90 },
  { course: 'Kurs', title: 'Praxis II', startTime: '09:00', durationMinutes: 90 },
  { course: 'Kurs', title: 'Abschluss', startTime: '09:00', durationMinutes: 90 },
];

const extensionCourseDays = [
  { course: 'Erweiterungskurs', title: 'Zusatzmodul 1', startTime: '09:00', durationMinutes: 120 },
  { course: 'Erweiterungskurs', title: 'Zusatzmodul 2', startTime: '09:00', durationMinutes: 120 },
  { course: 'Erweiterungskurs', title: 'Zusatzmodul 3', startTime: '09:00', durationMinutes: 120 },
  { course: 'Erweiterungskurs', title: 'Zusatzmodul 4', startTime: '09:00', durationMinutes: 120 },
  { course: 'Erweiterungskurs', title: 'Zusatzmodul 5', startTime: '09:00', durationMinutes: 120 },
];

// -----------------------------------------------------------------------------
// Hilfsfunktionen: Datum, Parsing, Formatierung
// -----------------------------------------------------------------------------
function parseGermanDate(input) {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(input).trim());
  if (!match) {
    throw new Error(`Ungültiges Datumsformat: "${input}". Erwartet wird z. B. 12.12.2026`);
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Ungültiges Kalenderdatum: "${input}"`);
  }

  return date;
}

function formatGermanDate(date) {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = date.getUTCFullYear();
  return `${d}.${m}.${y}`;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function isWeekend(date) {
  const day = date.getUTCDay(); // 0 = Sonntag, 6 = Samstag
  return day === 0 || day === 6;
}

// -----------------------------------------------------------------------------
// Feiertage in Deutschland (bundesweit) für beliebige Jahre
// -----------------------------------------------------------------------------
function easterSundayUTC(year) {
  // Meeus/Jones/Butcher Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = März, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function germanNationwideHolidays(year) {
  const easter = easterSundayUTC(year);
  const add = (days) => formatGermanDate(addDays(easter, days));

  return new Set([
    formatGermanDate(new Date(Date.UTC(year, 0, 1, 12, 0, 0))),   // Neujahr
    add(-2),   // Karfreitag
    add(1),    // Ostermontag
    formatGermanDate(new Date(Date.UTC(year, 4, 1, 12, 0, 0))),   // Tag der Arbeit
    add(39),   // Christi Himmelfahrt
    add(50),   // Pfingstmontag
    formatGermanDate(new Date(Date.UTC(year, 9, 3, 12, 0, 0))),   // Tag der Deutschen Einheit
    formatGermanDate(new Date(Date.UTC(year, 11, 25, 12, 0, 0))), // 1. Weihnachtstag
    formatGermanDate(new Date(Date.UTC(year, 11, 26, 12, 0, 0))), // 2. Weihnachtstag
  ]);
}

const holidayCache = new Map();

function isNationwideHoliday(date) {
  const year = date.getUTCFullYear();
  if (!holidayCache.has(year)) {
    holidayCache.set(year, germanNationwideHolidays(year));
  }
  return holidayCache.get(year).has(formatGermanDate(date));
}

function isNonTeachingDay(date) {
  return isWeekend(date) || isNationwideHoliday(date);
}

function nextTeachingDay(date) {
  let current = date;
  while (isNonTeachingDay(current)) {
    current = addDays(current, 1);
  }
  return current;
}

// -----------------------------------------------------------------------------
// Planung
// -----------------------------------------------------------------------------
function buildSchedule(startDate, days) {
  const result = [];
  let current = startDate;

  for (const dayInfo of days) {
    current = nextTeachingDay(current);
    result.push({
      ...dayInfo,
      date: new Date(current.getTime()),
    });
    current = addDays(current, 1);
  }

  return result;
}

function printSchedule(entries) {
  for (const [index, entry] of entries.entries()) {
    const label = `${String(index + 1).padStart(2, '0')}. ${entry.course}`;
    console.log(
      `${label} | ${formatGermanDate(entry.date)} | ${entry.title} | Start: ${entry.startTime} | Dauer: ${entry.durationMinutes} min`
    );
  }
}

function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('Aufruf: node plan-course.js 12.12.2026');
    process.exit(1);
  }

  let startDate;
  try {
    startDate = parseGermanDate(input);
  } catch (err) {
    console.error(`Fehler: ${err.message}`);
    process.exit(1);
  }

  const allDays = [...courseDays, ...extensionCourseDays];
  const schedule = buildSchedule(startDate, allDays);

  console.log(`Startdatum (Eingabe): ${input}`);
  console.log(`Erster Kurstag: ${formatGermanDate(schedule[0].date)}`);
  console.log('');
  printSchedule(schedule);
}

main();
