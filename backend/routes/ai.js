const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const { generateSuggestion, generateDashboardSummary, generateRecipeSuggestion } = require('../services/gemini');

// GET /api/ai/suggestion/:id - Generate/refresh AI suggestion for an item
router.get('/suggestion/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const suggestion = await generateSuggestion(
      item.name,
      item.expirationDate.toISOString(),
      item.category
    );

    // Cache the suggestion
    item.aiSuggestion = suggestion;
    await item.save();

    res.json({ suggestion });
  } catch (error) {
    console.error('Error generating suggestion:', error);
    res.status(500).json({ error: 'Failed to generate suggestion' });
  }
});

// GET /api/ai/dashboard-summary - Generate overall dashboard summary
router.get('/dashboard-summary', async (req, res) => {
  try {
    const items = await Item.find();
    const summary = await generateDashboardSummary(items);
    res.json({ summary });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate dashboard summary' });
  }
});

// GET /api/ai/recipe-suggestion - Suggest a recipe using expiring pantry items
router.get('/recipe-suggestion', async (req, res) => {
  try {
    const items = await Item.find().sort({ expirationDate: 1 });
    const recipe = await generateRecipeSuggestion(items);
    res.json({ recipe });
  } catch (error) {
    console.error('Error generating recipe:', error);
    res.status(500).json({ error: 'Failed to generate recipe suggestion' });
  }
});

module.exports = router;
