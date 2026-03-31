# 🏀 Courtside — NBA Player Dashboard

A personal NBA stats dashboard that updates daily at **2 AM ET** after all games finish. Track your favourite players — their last game stats are shown with smart prominence highlighting based on how exceptional the performance was.

---

## Features

- **Browse players** by Conference → Team, or search by name
- **Smart stat highlighting** — standout stats (30pt game, 15 rebounds) are visually prominent; ordinary stats are subtle
- **Personal watchlist** saved to your browser — no login needed
- **Daily refresh** via Netlify scheduled function at 2 AM ET
- **Dark mode** design with a court-inspired aesthetic

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Hosting | Netlify |
| Data | balldontlie.io API |
| Cron | Netlify Scheduled Functions |
| Styling | Tailwind CSS + CSS variables |
| State | React + localStorage |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/nba-dashboard.git
cd nba-dashboard
npm install
```

### 2. Get a balldontlie API key

1. Go to [balldontlie.io](https://www.balldontlie.io)
2. Sign up for a free account
3. Copy your API key

### 3. Set up environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
BALLDONTLIE_API_KEY=your_key_here
REVALIDATE_SECRET=any_random_string_here
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Netlify

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nba-dashboard.git
git push -u origin main
```

### Step 2: Connect to Netlify
1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git**
2. Select your GitHub repo
3. Build settings are auto-detected from `netlify.toml`
4. Click **Deploy site**

### Step 3: Add environment variables
In Netlify: **Site Settings → Environment Variables → Add variable**

| Key | Value |
|---|---|
| `BALLDONTLIE_API_KEY` | Your balldontlie key |
| `REVALIDATE_SECRET` | Any random secret string |

### Step 4: Enable Scheduled Functions
Netlify Scheduled Functions are enabled automatically via `netlify.toml`. The cron job runs at **07:00 UTC (2:00 AM ET)** daily.

---

## How the daily refresh works

```
2:00 AM ET
    │
    ├── Netlify Scheduled Function fires
    │     └── Calls /api/revalidate?secret=YOUR_SECRET
    │
    └── Next.js ISR cache is busted
          └── Next page load fetches fresh stats from balldontlie API
```

---

## Project Structure

```
nba-dashboard/
├── app/
│   ├── layout.tsx           # Root layout, fonts
│   ├── page.tsx             # Home page
│   ├── globals.css          # Global styles + CSS vars
│   └── api/
│       ├── teams/           # GET /api/teams
│       ├── players/         # GET /api/players
│       ├── stats/           # GET /api/stats
│       └── revalidate/      # POST /api/revalidate (cron trigger)
├── components/
│   ├── Header.tsx           # Sticky top bar
│   ├── DashboardClient.tsx  # Main page orchestrator
│   ├── PlayerCard.tsx       # Individual player stat card
│   ├── PlayerSelector.tsx   # Conference/team/player browser
│   └── EmptyState.tsx       # First-time empty state
├── lib/
│   ├── balldontlie.ts       # API client + types
│   ├── prominence.ts        # Stat highlighting algorithm
│   └── useWatchlist.ts      # localStorage watchlist hook
└── netlify/
    └── functions/
        └── refresh-stats.js # Daily 2AM cron job
```
