import React, { useState, useRef } from 'react';

const API_BASE = '/api';

export default function AddItemForm({ onClose, onItemAdded, categories = [], onAddCategory }) {
  const [stage, setStage] = useState('idle'); // idle | analyzing | review | submitting
  const [formData, setFormData] = useState({
    name: '',
    quantity: '1',
    category: 'Other',
    expirationDate: ''
  });
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [ocrError, setOcrError] = useState(false); // true when no date could be extracted
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === 'expirationDate') setOcrError(false);
  };

  const handleFileSelect = async (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target.result);
    reader.readAsDataURL(file);

    setStage('analyzing');
    setOcrError(false);

    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`${API_BASE}/items/analyze`, { method: 'POST', body: fd });

      if (res.ok) {
        const data = await res.json();
        const hasDate = data.expirationDate && data.dateSource !== 'none';
        setFormData({
          name: data.name || '',
          quantity: '1',
          category: data.category || 'Other',
          expirationDate: hasDate ? data.expirationDate : ''
        });
        if (!hasDate) setOcrError(true);
        setStage('review');
      } else {
        setOcrError(true);
        setStage('review');
      }
    } catch (error) {
      console.error('Analyze error:', error);
      setOcrError(true);
      setStage('review');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFileSelect(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.expirationDate) return;
    setStage('submitting');
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
        setStage('review');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setStage('review');
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const resetToIdle = () => {
    setStage('idle');
    setPreviewUrl(null);
    setOcrError(false);
    setFormData({ name: '', quantity: '1', category: 'Other', expirationDate: '' });
  };

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const success = await onAddCategory(trimmed);
    if (success) {
      setFormData(prev => ({ ...prev, category: trimmed }));
      setNewCategoryName('');
      setShowAddCategory(false);
    }
  };

  const CategorySelect = ({ id }) => (
    <div className="category-select-group">
      <select className="input" id={id} name="category"
        value={formData.category} onChange={handleChange}>
        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        <option value="__add__">+ Add Category...</option>
      </select>
      {formData.category === '__add__' && (
        <div className="add-category-inline">
          <input
            className="input"
            type="text"
            placeholder="New category name..."
            value={newCategoryName}
            onChange={e => setNewCategoryName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
            autoFocus
          />
          <button type="button" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={handleAddCategory}>Add</button>
          <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={() => { setFormData(prev => ({ ...prev, category: 'Other' })); setNewCategoryName(''); }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="form-overlay" onClick={handleOverlayClick}>
      <div className="form-panel">
        <div className="form-header">
          <h2 className="form-title">
            {stage === 'review' || stage === 'submitting' ? 'Confirm Item Details' : 'Add Pantry Item'}
          </h2>
          <button className="btn btn-ghost close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Stage: idle or analyzing — show upload zone */}
        {(stage === 'idle' || stage === 'analyzing') && (
          <>
            <div
              className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e.target.files[0])}
              />
              {stage === 'analyzing' ? (
                <>
                  {previewUrl && <img src={previewUrl} alt="Preview" className="upload-preview" />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', justifyContent: 'center' }}>
                    <div className="spinner"></div>
                    <span className="upload-text">Reading label with OCR + AI...</span>
                  </div>
                </>
              ) : (
                <>
                  <span className="upload-icon">📸</span>
                  <span className="upload-text">Drop a label photo or click to upload</span>
                  <span className="upload-hint">AI + OCR will read the expiry date automatically</span>
                </>
              )}
            </div>

            <div className="form-divider">or enter manually below</div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label" htmlFor="item-name">Item Name *</label>
                <input className="input" type="text" id="item-name" name="name"
                  placeholder="e.g., Milk, Eggs, Bread..."
                  value={formData.name} onChange={handleChange} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="label" htmlFor="item-quantity">Quantity</label>
                  <input className="input" type="text" id="item-quantity" name="quantity"
                    placeholder="e.g., 1 gallon" value={formData.quantity} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="item-category">Category</label>
                  <CategorySelect id="item-category" />
                </div>
              </div>
              <div className="form-group">
                <label className="label" htmlFor="item-expiration">Expiration Date *</label>
                <input className="input" type="date" id="item-expiration" name="expirationDate"
                  value={formData.expirationDate} onChange={handleChange} required />
              </div>
              <div className="submit-row">
                <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary"
                  disabled={!formData.name || !formData.expirationDate}>
                  🌿 Add to Pantry
                </button>
              </div>
            </form>
          </>
        )}

        {/* Stage: review — show pre-filled form after OCR/AI analysis */}
        {(stage === 'review' || stage === 'submitting') && (
          <>
            {previewUrl && (
              <div className="analyzed-preview">
                <img src={previewUrl} alt="Uploaded label" className="upload-preview" />
                <div className="analyzed-badge">
                  {ocrError ? (
                    <span>📸 Image uploaded</span>
                  ) : (
                    <span>✅ Label analyzed</span>
                  )}
                  <button className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                    onClick={resetToIdle}>
                    ↩ Re-upload
                  </button>
                </div>
              </div>
            )}

            {/* OCR error message */}
            {ocrError && (
              <div className="ocr-error-banner">
                <span>❌ Could not extract expiry date. Please try another image or enter it manually.</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label" htmlFor="review-name">Item Name *</label>
                <input className="input" type="text" id="review-name" name="name"
                  placeholder="Type the food name..."
                  value={formData.name} onChange={handleChange} required autoFocus />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="label" htmlFor="review-quantity">Quantity</label>
                  <input className="input" type="text" id="review-quantity" name="quantity"
                    value={formData.quantity} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="review-category">Category</label>
                  <CategorySelect id="review-category" />
                </div>
              </div>
              <div className="form-group">
                <label className="label" htmlFor="review-expiration">
                  Expiration Date *
                  {formData.expirationDate && !ocrError && <span className="ocr-hint"> (read from label)</span>}
                  {ocrError && <span className="ocr-hint error"> (enter manually)</span>}
                </label>
                <input className="input" type="date" id="review-expiration" name="expirationDate"
                  value={formData.expirationDate} onChange={handleChange} required />
              </div>
              <div className="submit-row">
                <button type="button" className="btn btn-ghost" onClick={resetToIdle}>← Back</button>
                <button type="submit" className="btn btn-primary"
                  disabled={stage === 'submitting' || !formData.name || !formData.expirationDate}>
                  {stage === 'submitting' ? (
                    <><div className="spinner"></div> Adding...</>
                  ) : (
                    '🌿 Add to Pantry'
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
