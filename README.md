# KayakLog

A personal mobile app to log kayak outings, track daily streaks, and analyze river stats.

Built with **Expo SDK 54** · **React Native** · **TypeScript**

---

## Features

- **Daily streak tracker** — flame widget with pulse animation, confetti celebration at 5+ day streaks
- **Trip logging** — per-river entries with laps, km, time, difficulty (I–VI), star rating, and notes
- **River autocomplete** — suggests past rivers as you type, auto-fills country and difficulty
- **184-country picker** — grouped by continent with flag emoji
- **Statistics** — weekly / monthly / yearly bar charts, km, time, laps, rivers, countries, avg rating
- **My Rivers** — aggregated view grouped by country with difficulty badges and star ratings
- **Daily notifications** — configurable reminder time, skips automatically if you already logged today

## Stack

| Layer | Tech |
|---|---|
| Framework | Expo SDK 54, Expo Router (file-based) |
| Language | TypeScript (strict) |
| State | React Context (`useApp()`) |
| Storage | AsyncStorage (`kayak_days_v4` / `kayak_settings_v1`) |
| Charts | react-native-gifted-charts |
| Animations | react-native-reanimated 4, react-native-confetti-cannon |
| Bottom sheets | @gorhom/bottom-sheet v5 |
| Notifications | expo-notifications |
| Date logic | date-fns v4 |

## Project Structure

```
app/
  (tabs)/
    index.tsx       # Home — streak widget + season stats
    log.tsx         # Trip log with year/month filter
    add.tsx         # Add / edit a day
    stats.tsx       # Charts and period stats
    rivers.tsx      # Rivers grouped by country
  settings.tsx      # Notifications + data summary

lib/
  types.ts          # Core interfaces (Day, River, Lap, Settings)
  AppContext.tsx     # Global state provider
  storage.ts        # AsyncStorage wrapper + seed data
  streak.ts         # Streak computation logic
  stats.ts          # Aggregation helpers for charts and cards
  filters.ts        # Filter helpers (all / year / month)
  dates.ts          # Date utilities (all date logic lives here)
  notifications.ts  # Schedule / cancel daily reminders
  countries.ts      # 184-country catalog grouped by continent

components/
  StreakWidget       # Animated streak card with week calendar
  StarRating         # 5-star SVG toggle input
  FilterSheet        # Bottom sheet for year/month filtering
  CountryPicker      # Full-screen searchable country modal
  RiverAutocomplete  # Typeahead from past river history
  DayCard            # Trip summary card for the log screen
```

## Getting Started

```bash
# Install dependencies
npm install

# Start Expo dev server (requires Expo Go SDK 54 on your device)
npx expo start
```

Scan the QR code with **Expo Go** (SDK 54).

## Data Model

```typescript
interface Day {
  id: number;
  date: string;        // ISO 8601 e.g. "2026-05-26"
  notes: string;
  rivers: River[];
}

interface River {
  name: string;
  country: string;     // ISO 3166-1 alpha-2
  difficulty: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
  laps: Lap[];
}

interface Lap {
  km: number;
  hours: number;
  minutes: number;
  stars: number;       // 0–5
  note: string;
}
```

## License

MIT
