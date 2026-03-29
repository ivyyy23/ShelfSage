const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const { initGemini } = require('./services/gemini');
const { seedDatabase } = require('./seed');
const itemsRouter = require('./routes/items');
const aiRouter = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 5000;

// In-memory custom categories (extends the default list)
const DEFAULT_CATEGORIES = ['Dairy', 'Produce', 'Meat', 'Grains', 'Canned', 'Condiments', 'Frozen', 'Beverages', 'Snacks', 'Other'];
let customCategories = [];

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Routes
app.use('/api/items', itemsRouter);
app.use('/api/ai', aiRouter);

// Categories API
app.get('/api/categories', (req, res) => {
  const all = [...DEFAULT_CATEGORIES, ...customCategories.filter(c => !DEFAULT_CATEGORIES.includes(c))];
  res.json(all);
});

app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }
  const trimmed = name.trim();
  const all = [...DEFAULT_CATEGORIES, ...customCategories];
  if (all.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())) {
    return res.status(409).json({ error: 'Category already exists' });
  }
  customCategories.push(trimmed);
  res.status(201).json({ name: trimmed });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Connect to MongoDB and start server
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shelfsage';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('🗄️  Connected to MongoDB');

    // Initialize Gemini AI
    initGemini();

    // Auto-seed demo data if database is empty
    await seedDatabase();

    app.listen(PORT, () => {
      console.log(`🚀 ShelfSage API running on http://localhost:${PORT}`);
      console.log(`📊 Dashboard API: http://localhost:${PORT}/api/items`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('\n💡 Make sure to set MONGODB_URI in your .env file.');
    console.log('   Copy .env.example to .env and fill in your MongoDB Atlas connection string.\n');
    process.exit(1);
  });
