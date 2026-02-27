# 🎙️ Podcast Analytics Dashboard

A comprehensive analytics dashboard for tracking podcast performance across **Spotify**, **Apple Podcasts**, and **YouTube**. View downloads, streams, and engagement metrics by individual episode or in aggregate — designed to help you understand what content resonates and how to grow your audience.

## Features

- **Dashboard Overview** — KPI cards, trend charts, platform breakdown pie chart, top episodes
- **Episodes Page** — Sortable/filterable table of all episodes with cross-platform metrics
- **Episode Detail** — Deep dive into any episode with per-platform breakdowns and daily performance charts
- **Platform Comparison** — Side-by-side analysis of Spotify, Apple, and YouTube with radar charts and growth trends
- **Performance Insights** — Topic analysis, guest vs solo comparison, publish day analysis, duration vs engagement scatter plot, growth trajectory
- **CSV Export** — Download all analytics data as a spreadsheet

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS |
| Charts | Recharts |
| Backend | Node.js + Express |
| Data | Mock data (JSON) with stub services for real API integration |

## Quick Start

### Prerequisites
- Node.js 18+ installed

### 1. Install Dependencies

```bash
cd podcast-analytics-dashboard

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Start the Backend

```bash
cd server
npm run dev
# Server runs on http://localhost:3001
```

### 3. Start the Frontend (in a separate terminal)

```bash
cd client
npm run dev
# Frontend runs on http://localhost:5173
```

### 4. Open the Dashboard

Navigate to **http://localhost:5173** in your browser.

## Project Structure

```
podcast-analytics-dashboard/
├── client/                     # React frontend (Vite)
│   └── src/
│       ├── components/         # Reusable UI components
│       │   ├── Layout/         # Sidebar, Layout wrapper
│       │   └── common/         # KpiCard, LoadingSpinner, ErrorMessage
│       ├── pages/              # Page components
│       │   ├── Dashboard.jsx   # Main overview dashboard
│       │   ├── Episodes.jsx    # Episode list with filters
│       │   ├── EpisodeDetail.jsx # Single episode deep dive
│       │   ├── Platforms.jsx   # Platform comparison
│       │   └── Insights.jsx    # Performance insights & analysis
│       ├── services/           # API client
│       ├── hooks/              # Custom React hooks
│       └── utils/              # Formatters and constants
├── server/                     # Node.js backend
│   ├── services/               # Platform API services (stubs)
│   │   ├── spotify-service.js
│   │   ├── apple-service.js
│   │   ├── youtube-service.js
│   │   └── aggregator.js      # Cross-platform data normalization
│   ├── mock/                   # Mock data files
│   │   ├── generate-mock-data.js
│   │   ├── spotify-data.json
│   │   ├── apple-data.json
│   │   ├── youtube-data.json
│   │   └── episodes.json
│   └── server.js               # Express API server
├── docs/
│   └── API_INTEGRATION.md      # Guide for connecting real APIs
├── .env.example                # Environment variable template
└── README.md
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/analytics/overview` | Dashboard KPIs and platform breakdown |
| `GET /api/analytics/episodes` | All episodes with cross-platform metrics |
| `GET /api/analytics/episodes/:id` | Single episode with full platform detail |
| `GET /api/analytics/trends` | Daily/weekly aggregate trends |
| `GET /api/analytics/platforms` | Platform comparison data |
| `GET /api/analytics/insights` | Performance insights and analysis |
| `GET /api/analytics/export` | CSV export of all episode data |

## Mock Data

The dashboard ships with realistic mock data for **26 episodes** (1 per week over 6 months) including:
- Varied episode types (interviews, deep dives, Q&A, solo, special events)
- Realistic download/stream curves with day-of-week effects
- 3 "breakout" episodes and 2 "underperformers" for analysis
- Platform-specific metrics (Spotify streams, Apple downloads, YouTube views)
- Demographics, device breakdowns, and traffic sources

## Connecting Real APIs

See [docs/API_INTEGRATION.md](docs/API_INTEGRATION.md) for detailed instructions on connecting to:
- Spotify for Podcasters API
- Apple Podcasts Connect API
- YouTube Data API / YouTube Analytics API

## License

MIT
