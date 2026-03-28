import React, { useState, useRef } from 'react';

const API_BASE = '/api';

const CATEGORIES = ['Dairy', 'Produce', 'Meat', 'Grains', 'Canned', 'Condiments', 'Frozen', 'Beverages', 'Snacks', 'Other'];

export default function AddItemForm({ onClose, onItemAdded }) {
  const [formData, setFormData] = useState({
    name: '',
    quantity: '1',
    category: 'Other',
    expirationDate: ''
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleFileSelect = async (file) => {
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target.result);
    reader.readAsDataURL(file);

    // Upload to API
    setUploading(true);
    setUploadResult(null);

    try {
      const formDataObj = new FormData();
      formDataObj.append('image', file);

      const res = await fetch(`${API_BASE}/items/upload`, {
        method: 'POST',
        body: formDataObj
      });

      if (res.ok) {
        const newItem = await res.json();
        setUploadResult(newItem);
        onItemAdded(newItem);
        // Auto-close after a brief delay
        setTimeout(() => onClose(), 1500);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadResult(null);
      // Fall back to manual entry — let user fill the form
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.expirationDate) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const newItem = await res.json();
        onItemAdded(newItem);
        onClose();
      } else {
        throw new Error('Failed to add item');
      }
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="form-overlay" onClick={handleOverlayClick}>
      <div className="form-panel">
        <div className="form-header">
          <h2 className="form-title">Add Pantry Item</h2>
          <button className="btn btn-ghost close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Photo Upload */}
        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileSelect(e.target.files[0])}
          />

          {uploading ? (
            <>
              <div className="spinner spinner-lg" style={{ margin: '0 auto var(--space-sm)' }}></div>
              <span className="upload-text">AI is identifying your food...</span>
            </>
          ) : previewUrl ? (
            <>
              <img src={previewUrl} alt="Preview" className="upload-preview" />
              {uploadResult && (
                <div className="upload-result">
                  ✅ Identified: <strong>{uploadResult.name}</strong> — added to pantry!
                </div>
              )}
            </>
          ) : (
            <>
              <span className="upload-icon">📸</span>
              <span className="upload-text">Drop a photo or click to upload</span>
              <span className="upload-hint">AI will identify the food automatically</span>
            </>
          )}
        </div>

        <div className="form-divider">or enter manually</div>

        {/* Manual Entry Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label" htmlFor="item-name">Item Name *</label>
            <input
              className="input"
              type="text"
              id="item-name"
              name="name"
              placeholder="e.g., Milk, Eggs, Bread..."
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="label" htmlFor="item-quantity">Quantity</label>
              <input
                className="input"
                type="text"
                id="item-quantity"
                name="quantity"
                placeholder="e.g., 1 gallon"
                value={formData.quantity}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="label" htmlFor="item-category">Category</label>
              <select
                className="input"
                id="item-category"
                name="category"
                value={formData.category}
                onChange={handleChange}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="label" htmlFor="item-expiration">Expiration Date *</label>
            <input
              className="input"
              type="date"
              id="item-expiration"
              name="expirationDate"
              value={formData.expirationDate}
              onChange={handleChange}
              required
            />
          </div>

          <div className="submit-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !formData.name || !formData.expirationDate}
            >
              {submitting ? (
                <>
                  <div className="spinner"></div>
                  Adding...
                </>
              ) : (
                <>🌿 Add to Pantry</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
