# 🌿 ShelfSage — Smart Pantry Tracker

> Never waste a bite. Smart pantry management for home users and small businesses.

ShelfSage helps you track pantry items, monitor expiration dates with color-coded alerts, and get AI-powered usage suggestions — all in a beautiful, modern dashboard.

![ShelfSage](https://img.shields.io/badge/ShelfSage-Smart%20Pantry-10b981?style=for-the-badge)

## ✨ Features

- **📦 Item Logging** — Add items manually or snap a photo (AI identifies the food!)
- **🤖 AI Usage Suggestions** — Powered by Google Gemini, get practical tips for each item
- **🎨 Color-Coded Dashboard** — Red (expired), Yellow (expiring soon), Green (fresh)
- **📊 Smart Stats** — At-a-glance counts of items by status
- **🌱 Pre-Populated Demo** — 16 realistic pantry items for instant demo
- **📸 Photo Upload** — Drag & drop images for AI food identification

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite) |
| Styling | Vanilla CSS (Glassmorphism dark theme) |
| Backend | Node.js + Express |
| Database | MongoDB Atlas (free tier) |
| AI | Google Gemini 2.0 Flash |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier) or local MongoDB
- Google Gemini API key (optional — app works with mock data)

### 1. Clone & Setup

```bash
git clone https://github.com/ivyyy23/ShelfSage.git
cd ShelfSage
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI and Gemini API key
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Open

Visit **http://localhost:5173** — the dashboard loads with 16 pre-populated demo items!

## 📁 Project Structure

```
ShelfSage/
├── frontend/          # Vite + React app
│   └── src/
│       ├── components/
│       │   ├── Header.jsx
│       │   ├── Dashboard.jsx
│       │   ├── ItemCard.jsx
│       │   ├── AddItemForm.jsx
│       │   └── ItemModal.jsx
│       ├── App.jsx
│       ├── App.css
│       └── index.css
├── backend/
│   ├── models/Item.js
│   ├── routes/
│   │   ├── items.js
│   │   └── ai.js
│   ├── services/gemini.js
│   ├── seed.js
│   └── server.js
└── README.md
```

## 🎯 Demo Flow (2 min)

1. Open dashboard → 16 pre-populated items with color coding
2. Red items pulse — use them today!
3. Click any item → see AI usage suggestion
4. Click "+ Add Item" → add manually or upload a photo
5. Stats bar updates in real-time

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|------------|----------|
| `MONGODB_URI` | MongoDB Atlas connection string | ✅ |
| `GEMINI_API_KEY` | Google Gemini API key | ❌ (uses mock data) |
| `PORT` | Backend port (default: 5000) | ❌ |

## 📝 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/items` | List all items |
| POST | `/api/items` | Add item (manual) |
| POST | `/api/items/upload` | Add item (photo AI) |
| DELETE | `/api/items/:id` | Delete item |
| GET | `/api/ai/suggestion/:id` | Get AI suggestion |
| GET | `/api/ai/dashboard-summary` | Get dashboard summary |

## 🏆 Built for HackIndy 2026

Built in 24 hours at HackIndy hackathon.

---

Made with 🌿 by the ShelfSage team
