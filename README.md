# JavaScript Course Planner

Dieses Node.js-Skript erstellt einen Kursplan aus einem 10-tägigen Hauptkurs und einem 5-tägigen Erweiterungskurs.
Dabei werden Wochenenden und bundeseinheitliche Feiertage (via Nager.Date API) automatisch übersprungen.

(Ich habe mich bei der Benennung der Kurstage von meiner Masterarbeit inspirieren lassen. :) )

## Nutzung
```bash
node plan-course.js DD.MM.YYYY
