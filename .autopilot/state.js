window.STATE =
{
  "slug": "site-audit-responsive",
  "title": "Аудит и адаптация сайта",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-09-01-brief.md",
  "memoryFile": "AGENTS.md",
  "startedAt": "2026-09-01T01:24:31+04:00",
  "updatedAt": "2026-09-01T01:42:00+04:00",
  "finishedAt": null,
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-09-01T01:24:31+04:00", "finishedAt": "2026-09-01T01:25:10+04:00" },
    { "id": "manifest", "status": "done", "startedAt": "2026-09-01T01:25:10+04:00", "finishedAt": "2026-09-01T01:29:40+04:00" },
    { "id": "briefing", "status": "done", "startedAt": "2026-09-01T01:29:40+04:00", "finishedAt": "2026-09-01T01:29:40+04:00", "note": "вопросов не потребовалось: аудит локальной версии" },
    { "id": "spec", "status": "done", "startedAt": "2026-09-01T01:29:40+04:00", "finishedAt": "2026-09-01T01:33:12+04:00" },
    { "id": "plan", "status": "done", "startedAt": "2026-09-01T01:33:12+04:00", "finishedAt": "2026-09-01T01:34:00+04:00", "note": "2 таска, ярус T1" },
    { "id": "build", "status": "active", "startedAt": "2026-09-01T01:34:00+04:00" },
    { "id": "review", "status": "pending" },
    { "id": "final", "status": "pending" }
  ],
  "requirements": { "total": 4, "done": 0, "inTicket": 4, "inSpec": 0, "placeholder": 0, "deferred": 0, "dropped": 0 },
  "tickets": [
    { "id": "01", "title": "Браузерный аудит страниц", "requirements": ["R01", "R04", "A01"], "blockedBy": [], "wave": 1, "zone": ["index.html", "mebel.html", "raspil.html", ".autopilot/site-audit-responsive/"], "status": "repair", "startedAt": "2026-09-01T01:34:00+04:00", "retries": 0, "repairs": 1 },
    { "id": "02", "title": "Исправление подтверждённой адаптивности и метаданных", "requirements": ["R02", "R03", "R04", "A01"], "blockedBy": ["01"], "wave": 2, "zone": ["css/unified-design-system.css", "index.html", "mebel.html", "raspil.html"], "status": "pending", "retries": 0, "repairs": 0 }
  ],
  "singlePass": null,
  "tests": { "passed": 15, "failed": 0 },
  "debt": { "placeholders": [], "assumptions": ["Проверка на репрезентативных ширинах, а не на каждой модели устройства"], "emptyEnv": [] },
  "additions": ["A01 → R04: проверка клавиатурной доступности ключевых ссылок"],
  "coverage": { "findings": 4, "result": "Уточнена граница устройства; A01 привязано к R04; остальные пункты — решения реализации." },
  "blind": null
}
