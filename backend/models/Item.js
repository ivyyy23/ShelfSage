const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: String,
    default: '1'
  },
  category: {
    type: String,
    default: 'Other'
  },
  expirationDate: {
    type: Date,
    required: true
  },
  addedDate: {
    type: Date,
    default: Date.now
  },
  imageUrl: {
    type: String,
    default: null
  },
  aiSuggestion: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Virtual field to compute status based on expiration
itemSchema.virtual('status').get(function () {
  const now = new Date();
  const expDate = new Date(this.expirationDate);
  const diffTime = expDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'expired';
  if (diffDays <= 14) return 'warning';
  return 'safe';
});

// Virtual for days until expiry
itemSchema.virtual('daysUntilExpiry').get(function () {
  const now = new Date();
  const expDate = new Date(this.expirationDate);
  const diffTime = expDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Ensure virtuals are included in JSON output
itemSchema.set('toJSON', { virtuals: true });
itemSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Item', itemSchema);
