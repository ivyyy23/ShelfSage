import React, { useState } from 'react';
import ItemCard from './ItemCard';

const API_BASE = '/api';

const FILTERS = [
  { key: 'all', label: 'All Items' },
  { key: 'expired', label: '🔴 Expiring' },
  { key: 'warning', label: '🟡 Soon' },
  { key: 'safe', label: '🟢 Fresh' }
];

export default function Dashboard({ items, onItemClick, onDeleteItem, onAddClick, aiSummary }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [showRecipe, setShowRecipe] = useState(false);
  const [recipe, setRecipe] = useState('');
  const [recipeLoading, setRecipeLoading] = useState(false);

  const filtered = activeFilter === 'all'
    ? items
    : items.filter(item => item.status === activeFilter);

  const handleGetRecipe = async () => {
    setShowRecipe(true);
    if (recipe) return; // already loaded
    setRecipeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ai/recipe-suggestion`);
      if (res.ok) {
        const data = await res.json();
        setRecipe(data.recipe);
      }
    } catch (error) {
      console.error('Error fetching recipe:', error);
      setRecipe('Could not generate a recipe right now. Try again!');
    } finally {
      setRecipeLoading(false);
    }
  };

  const handleRefreshRecipe = async () => {
    setRecipe('');
    setRecipeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ai/recipe-suggestion`);
      if (res.ok) {
        const data = await res.json();
        setRecipe(data.recipe);
      }
    } catch (error) {
      setRecipe('Could not generate a recipe right now. Try again!');
    } finally {
      setRecipeLoading(false);
    }
  };

  return (
    <div>
      {/* AI Summary Banner */}
      {aiSummary && (
        <div className="ai-banner">
          <span className="ai-banner-icon">✨</span>
          <p className="ai-banner-text">{aiSummary}</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="toolbar">
        <div className="filter-tabs">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`filter-tab ${activeFilter === f.key ? 'active' : ''}`}
              onClick={() => setActiveFilter(f.key)}
              id={`filter-${f.key}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          <button
            className="btn btn-ghost recipe-btn"
            onClick={handleGetRecipe}
            disabled={items.length === 0}
            id="recipe-btn"
          >
            🍳 What can I cook?
          </button>
          <button
            className="btn btn-primary add-btn"
            onClick={onAddClick}
            id="add-item-btn"
          >
            <span className="plus-icon">+</span> Add Item
          </button>
        </div>
      </div>

      {/* Recipe Panel */}
      {showRecipe && (
        <div className="recipe-panel">
          <div className="recipe-header">
            <div className="ai-label">
              <span className="ai-sparkle">🍳</span>
              Recipe Suggestion
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button
                className="btn btn-ghost regenerate-btn"
                onClick={handleRefreshRecipe}
                disabled={recipeLoading}
              >
                {recipeLoading ? <><div className="spinner"></div> Thinking...</> : '🔄 New Recipe'}
              </button>
              <button
                className="btn btn-ghost regenerate-btn"
                onClick={() => setShowRecipe(false)}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="recipe-body">
            {recipeLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--text-muted)' }}>
                <div className="spinner"></div>
                <span>Finding the best recipe for your pantry...</span>
              </div>
            ) : (
              <p className="ai-text" style={{ whiteSpace: 'pre-line' }}>{recipe}</p>
            )}
          </div>
        </div>
      )}

      {/* Items Grid */}
      {filtered.length > 0 ? (
        <div className="items-grid">
          {filtered.map((item, i) => (
            <ItemCard
              key={item._id}
              item={item}
              onClick={onItemClick}
              onDelete={onDeleteItem}
              index={i}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <h3 className="empty-title">
            {activeFilter === 'all' ? 'Your pantry is empty' : `No ${activeFilter} items`}
          </h3>
          <p className="empty-text">
            {activeFilter === 'all'
              ? 'Add items to start tracking your pantry!'
              : 'Try a different filter or add new items.'}
          </p>
        </div>
      )}
    </div>
  );
}
