# RozFlow — Daily Life OS

A brand-new, local-first Android app for everyday life management. It is independent from SubSathi.

## Included in v1
- Animated, gradient launch experience with a 3D-inspired orbit logo.
- Today dashboard with daily progress, tasks, focus time, habits and spending.
- Personal task planner with dates, priorities, notes and completion.
- Habit check-ins, daily streak calculations and starter templates.
- Focus timer with 15, 25 and 50 minute sessions.
- Manual expense log, categories, monthly budget guide and spending breakdown.
- Bills and reminders; local reminder notification scheduled one day before when permission is granted. Recurring dates advance when the user marks a bill paid.
- JSON backup export.
- SQLite storage on the phone, with no account, Gmail, email scanning, bank connection or cloud AI required.

## Development
```sh
npm install
npm run typecheck
npx expo prebuild --platform android --non-interactive --no-install
cd android && ./gradlew assembleRelease
```

## Important limits
- Focus timer, expense tracking and bill reminders are tools, not financial or medical advice.
- RozFlow does not make payments, connect to bank accounts, or automatically synchronize to cloud storage.
- Export a backup before clearing local data or moving to a new phone.
