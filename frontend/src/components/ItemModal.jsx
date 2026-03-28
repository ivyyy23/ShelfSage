import React, { useState, useCallback } from 'react';

const API_BASE = '/api';

const CATEGORIES = ['Dairy', 'Produce', 'Meat', 'Grains', 'Canned', 'Condiments', 'Frozen', 'Beverages', 'Snacks', 'Other'];

const CATEGORY_EMOJIS = {
  Dairy: '🥛',
  Produce: '🥬',
  Meat: '🥩',
  Grains: '🌾',
  Canned: '🥫',
  Condiments: '🧂',
  Frozen: '❄️',
  Beverages: '🥤',
  Snacks: '🍿',
  Other: '📦'
};

function getStatusBadge(status) {
  if (status === 'expired') return { class: 'badge badge-danger', label: 'Expired / Use Today' };
  if (status === 'warning') return { class: 'badge badge-warning', label: 'Expiring Soon' };
  return { class: 'badge badge-safe', label: 'Fresh' };
}

function toDateInputValue(dateStr) {
  const d = new Date(dateStr);
  return d.toISOString().split('T')[0];
}

export default function ItemModal({ item, onClose, onItemUpdated }) {
  const [suggestion, setSuggestion] = useState(item.aiSuggestion || null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({
    name: item.name,
    quantity: item.quantity,
    category: item.category,
    expirationDate: toDateInputValue(item.expirationDate)
  });

  const badge = getStatusBadge(item.status);
  const emoji = CATEGORY_EMOJIS[item.category] || '📦';

  const expirationFormatted = new Date(item.expirationDate).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const addedFormatted = new Date(item.addedDate || item.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const regenerateSuggestion = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ai/suggestion/${item._id}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestion(data.suggestion);
      }
    } catch (error) {
      console.error('Error regenerating suggestion:', error);
    } finally {
      setLoading(false);
    }
  }, [item._id]);

  const handleEditChange = (e) => {
    setEditData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editData.name || !editData.expirationDate) return;
    setSaving(true);
    try {
      await onItemUpdated(item._id, editData);
      setEditMode(false);
    } catch (error) {
      console.error('Error saving item:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <button className="btn btn-ghost modal-close" onClick={onClose}>✕</button>

        {editMode ? (
          <form onSubmit={handleSave}>
            <h2 className="modal-item-name" style={{ marginBottom: 'var(--space-lg)' }}>Edit Item</h2>

            <div className="form-group">
              <label className="label" htmlFor="edit-name">Item Name *</label>
              <input
                className="input"
                type="text"
                id="edit-name"
                name="name"
                value={editData.name}
                onChange={handleEditChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="label" htmlFor="edit-quantity">Quantity</label>
                <input
                  className="input"
                  type="text"
                  id="edit-quantity"
                  name="quantity"
                  value={editData.quantity}
                  onChange={handleEditChange}
                />
              </div>
              <div className="form-group">
                <label className="label" htmlFor="edit-category">Category</label>
                <select
                  className="input"
                  id="edit-category"
                  name="category"
                  value={editData.category}
                  onChange={handleEditChange}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="label" htmlFor="edit-expiration">Expiration Date *</label>
              <input
                className="input"
                type="date"
                id="edit-expiration"
                name="expirationDate"
                value={editData.expirationDate}
                onChange={handleEditChange}
                required
              />
            </div>

            <div className="submit-row" style={{ marginTop: 'var(--space-md)' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditMode(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || !editData.name || !editData.expirationDate}
              >
                {saving ? (
                  <><div className="spinner"></div> Saving...</>
                ) : (
                  '💾 Save Changes'
                )}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="modal-title-row">
              <h2 className="modal-item-name">{item.name}</h2>
              <button
                className="btn btn-ghost edit-btn"
                onClick={() => setEditMode(true)}
              >
                ✏️ Edit
              </button>
            </div>

            <div className="modal-meta">
              <span className={badge.class}>{badge.label}</span>
              <span className="category-badge">{emoji} {item.category}</span>
            </div>

            <div className="modal-details">
              <div className="detail-card">
                <div className="detail-label">Quantity</div>
                <div className="detail-value">{item.quantity}</div>
              </div>
              <div className="detail-card">
                <div className="detail-label">Expires</div>
                <div className="detail-value" style={{
                  color: item.status === 'expired' ? 'var(--danger-light)' :
                         item.status === 'warning' ? 'var(--warning-light)' :
                         'var(--safe-light)'
                }}>
                  {item.daysUntilExpiry <= 0
                    ? `${Math.abs(item.daysUntilExpiry)} days ago`
                    : item.daysUntilExpiry === 1
                      ? 'Tomorrow'
                      : `In ${item.daysUntilExpiry} days`
                  }
                </div>
              </div>
              <div className="detail-card">
                <div className="detail-label">Expiration Date</div>
                <div className="detail-value" style={{ fontSize: '0.85rem' }}>{expirationFormatted}</div>
              </div>
              <div className="detail-card">
                <div className="detail-label">Added</div>
                <div className="detail-value" style={{ fontSize: '0.85rem' }}>{addedFormatted}</div>
              </div>
            </div>

            {/* AI Suggestion */}
            <div className="ai-section">
              <div className="ai-header">
                <div className="ai-label">
                  <span className="ai-sparkle">✨</span>
                  AI Suggestion
                </div>
                <button
                  className="btn btn-ghost regenerate-btn"
                  onClick={regenerateSuggestion}
                  disabled={loading}
                >
                  {loading ? (
                    <><div className="spinner"></div> Thinking...</>
                  ) : (
                    '🔄 Refresh'
                  )}
                </button>
              </div>
              <p className="ai-text">
                {loading ? 'Generating a fresh suggestion...' : (suggestion || 'Click refresh to get an AI suggestion for this item.')}
              </p>
            </div>

            {/* Item image if available */}
            {item.imageUrl && (
              <div style={{ marginTop: 'var(--space-md)' }}>
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  style={{
                    width: '100%',
                    borderRadius: 'var(--radius-md)',
                    maxHeight: '200px',
                    objectFit: 'cover'
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
