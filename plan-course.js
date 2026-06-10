const https = require('https');

// ==========================================
// 1. Datenstruktur & Konfiguration
// ==========================================

// Kurs (10 Tage)
const mainCourse = [
    { title: "Neuronale Netze & Deep Learning Basics", startTime: "09:00", duration: "6h" },
    { title: "Loss Functions & Gradient Optimization", startTime: "09:00", duration: "6h" },
    { title: "Hyperparameter Tuning für Stabilität", startTime: "09:00", duration: "6h" },
    { title: "Strukturanalyse: Datenverteilung im Raum", startTime: "09:00", duration: "6h" },
    { title: "Architektur: Multi-Objective Optimization", startTime: "09:00", duration: "6h" },
    { title: "Constrained Search Spaces mit Optuna", startTime: "09:00", duration: "6h" },
    { title: "Einsatz von NSGA-II und MOTPE", startTime: "09:00", duration: "6h" },
    { title: "Einführung in Generative Modelle", startTime: "09:00", duration: "6h" },
    { title: "Trainingsloops in PyTorch", startTime: "09:00", duration: "6h" },
    { title: "Kurs-Abschlussprojekt", startTime: "09:00", duration: "6h" }
].map((day, index) => ({ ...day, type: 'Kurs', index: index + 1 }));

// Erweiterungskurs (5 Tage)
const extensionCourse = [
    { title: "Advanced Conditional GANs", startTime: "10:00", duration: "4h" },
    { title: "Emulation räumlicher Daten (Geostatistik)", startTime: "10:00", duration: "4h" },
    { title: "Gradient Clipping & DiffAugment", startTime: "10:00", duration: "4h" },
    { title: "Overfitting & Varianz-Analyse", startTime: "10:00", duration: "4h" },
    { title: "Integration in Schulungssysteme", startTime: "10:00", duration: "4h" }
].map((day, index) => ({ ...day, type: 'Erweiterung', index: index + 1 }));

// Die lückenlose Sequenz
const allCourseDays = [...mainCourse, ...extensionCourse];


// ==========================================
// 2. Hilfsfunktionen
// ==========================================

/**
 * Holt die Feiertage für ein bestimmtes Jahr via Nager.Date API
 * Gibt ein Promise zurück, das zu einem Array mit bundeseinheitlichen Feiertagen im Format YYYY-MM-DD auflöst.
 */
function fetchHolidays(year) {
    return new Promise((resolve, reject) => {
        const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/DE`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const holidays = JSON.parse(data);
                        // Edge-Case: Nur "bundeseinheitliche" Feiertage herausfiltern (bei dieser API ist 'global' = true)
                        const nationwide = holidays
                            .filter(h => h.global === true)
                            .map(h => h.date);
                        resolve(nationwide);
                    } catch (e) {
                        reject(new Error("Fehler beim Parsen der API-Antwort."));
                    }
                } else {
                    reject(new Error(`API Error: Status ${res.statusCode}`));
                }
            });
        }).on('error', (err) => reject(err));
    });
}

/**
 * Parst das Startdatum aus dem Format DD.MM.YYYY
 * Setzt die Uhrzeit auf 12:00 Uhr, um DST-Verschiebungen (Sommer-/Winterzeit) zu vermeiden.
 */
function parseGermanDate(dateString) {
    const parts = dateString.split('.');
    if (parts.length !== 3) throw new Error("Falsches Format.");
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; 
    const year = parseInt(parts[2], 10);

    const date = new Date(year, month, day, 12, 0, 0, 0);
    if (isNaN(date.getTime())) throw new Error("Ungültiges Datum.");
    return date;
}

/**
 * Formatiert ein Date-Objekt in DD.MM.YYYY
 */
function formatDateToDE(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
}

/**
 * Formatiert ein Date-Objekt in YYYY-MM-DD (für den Abgleich mit der API)
 */
function formatDateToISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Prüft, ob das gegebene Datum auf ein Wochenende fällt.
 */
function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 = Sonntag, 6 = Samstag
}


// ==========================================
// 3. Hauptlogik
// ==========================================

async function main() {
    // 1. Argument-Prüfung
    const inputDate = process.argv[2];
    if (!inputDate) {
        console.error("Bitte ein Startdatum übergeben. \nBeispiel: node plan-course.js 12.12.2026");
        process.exit(1);
    }

    let currentDate;
    try {
        currentDate = parseGermanDate(inputDate);
    } catch (err) {
        console.error("Fehler beim Parsen des Datums. Bitte Format DD.MM.YYYY verwenden.");
        process.exit(1);
    }

    const startYear = currentDate.getFullYear();

    // 2. Feiertage asynchron besorgen (Max 2 API-Calls für Jahr 1 & Jahr 2)
    console.log(`\nLade bundeseinheitliche Feiertage für ${startYear} und ${startYear + 1}...\n`);
    const holidaysSet = new Set();
    
    try {
        // Parallel fetching für bessere Performance
        const [holidaysY1, holidaysY2] = await Promise.all([
            fetchHolidays(startYear),
            fetchHolidays(startYear + 1)
        ]);
        
        holidaysY1.forEach(h => holidaysSet.add(h));
        holidaysY2.forEach(h => holidaysSet.add(h));
    } catch (err) {
        console.error("Fehler beim Abrufen der Feiertage:", err.message);
        process.exit(1);
    }

    // 3. Iteration & Scheduling
    let coursePointer = 0;
    
    console.log("------------------------------------------------------------------------------------------------");
    console.log(`Kursplanung (Startdatum: ${inputDate})`);
    console.log("------------------------------------------------------------------------------------------------\n");

    while (coursePointer < allCourseDays.length) {
        const isoDateString = formatDateToISO(currentDate);

        // Edge-Case Handling: Wenn das Eingabedatum direkt ein Feiertag oder Wochenende ist, 
        // wird es hier abgefangen und der Kursbeginn auf den nächsten Werktag verschoben.
        if (isWeekend(currentDate) || holidaysSet.has(isoDateString)) {
            // Tag überspringen
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }

        // Es ist ein regulärer Arbeitstag! Kurstag zuweisen.
        const currentCourseInfo = allCourseDays[coursePointer];
        
        const typeLabel = currentCourseInfo.type === 'Kurs' ? '[Hauptkurs] ' : '[Erweiterung]';
        const dayLabel = `Tag ${String(currentCourseInfo.index).padStart(2, '0')}`;
        const dateLabel = formatDateToDE(currentDate);
        
        console.log(`${dateLabel} | ${typeLabel.padEnd(14)} | ${dayLabel} | Start: ${currentCourseInfo.startTime} (${currentCourseInfo.duration}) | ${currentCourseInfo.title}`);

        // Pointer und Datum für den nächsten Durchlauf inkrementieren
        currentCourseInfo.assignedDate = new Date(currentDate); 
        currentDate.setDate(currentDate.getDate() + 1);
        coursePointer++;
        
        // Optische Trennung zwischen Kurs und Erweiterung in der Konsole
        if (coursePointer === mainCourse.length) {
            console.log("- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ");
        }
    }
    
    console.log("\n Planung erfolgreich abgeschlossen.\n");
}

// Skript ausführen
main();