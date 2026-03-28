const express = require('express');
const router = express.Router();
const multer = require('multer');
const Item = require('../models/Item');
const { identifyFoodFromImage, generateSuggestion } = require('../services/gemini');
const { extractExpiryFromImage } = require('../services/ocr');

// Configure multer for memory storage (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'), false);
    }
  }
});

// GET /api/items - Fetch all items sorted by expiration date
router.get('/', async (req, res) => {
  try {
    const items = await Item.find().sort({ expirationDate: 1 });
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// POST /api/items - Add item manually
router.post('/', async (req, res) => {
  try {
    const { name, quantity, category, expirationDate } = req.body;

    if (!name || !expirationDate) {
      return res.status(400).json({ error: 'Name and expiration date are required' });
    }

    const item = new Item({
      name,
      quantity: quantity || '1',
      category: category || 'Other',
      expirationDate: new Date(expirationDate)
    });

    // Generate AI suggestion for the new item
    try {
      item.aiSuggestion = await generateSuggestion(name, expirationDate, category || 'Other');
    } catch (e) {
      console.error('Could not generate suggestion:', e.message);
    }

    await item.save();
    res.status(201).json(item);
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// POST /api/items/analyze - Analyze image for food name and expiry date (no DB save)
router.post('/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // Run Gemini Vision and Tesseract OCR in parallel
    const [identified, ocrResult] = await Promise.all([
      identifyFoodFromImage(req.file.buffer, req.file.mimetype),
      extractExpiryFromImage(req.file.buffer)
    ]);

    // Prefer OCR-parsed date (from label text), fall back to Gemini's extracted date
    let expirationDate = ocrResult.expiryDate || identified.expirationDate || null;

    // Last resort: estimate from shelf life
    if (!expirationDate && identified.estimatedShelfLifeDays) {
      const d = new Date();
      d.setDate(d.getDate() + identified.estimatedShelfLifeDays);
      expirationDate = d.toISOString().split('T')[0];
    }

    res.json({
      name: identified.name || '',
      category: identified.category || 'Other',
      expirationDate: expirationDate || ''
    });
  } catch (error) {
    console.error('Error analyzing image:', error);
    res.status(500).json({ error: 'Failed to analyze image' });
  }
});

// POST /api/items/upload - Upload photo to identify food
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // Use Gemini Vision to identify the food
    const identified = await identifyFoodFromImage(req.file.buffer, req.file.mimetype);

    // Calculate expiration date based on estimated shelf life
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + (identified.estimatedShelfLifeDays || 7));

    // Create the item
    const item = new Item({
      name: identified.name,
      quantity: '1',
      category: identified.category || 'Other',
      expirationDate,
      imageUrl: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
    });

    // Generate AI suggestion
    try {
      item.aiSuggestion = await generateSuggestion(
        identified.name,
        expirationDate.toISOString(),
        identified.category || 'Other'
      );
    } catch (e) {
      console.error('Could not generate suggestion:', e.message);
    }

    await item.save();
    res.status(201).json(item);
  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).json({ error: 'Failed to process image upload' });
  }
});

// PUT /api/items/:id - Update an existing item
router.put('/:id', async (req, res) => {
  try {
    const { name, quantity, category, expirationDate } = req.body;

    if (!name || !expirationDate) {
      return res.status(400).json({ error: 'Name and expiration date are required' });
    }

    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { name, quantity, category, expirationDate: new Date(expirationDate) },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/items/:id - Remove an item
router.delete('/:id', async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item deleted', item });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = router;
