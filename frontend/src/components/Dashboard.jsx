import React, { useState, useMemo } from 'react';
import ItemCard from './ItemCard';

const API_BASE = '/api';

const FILTERS = [
  { key: 'all', label: 'All Items' },
  { key: 'expired', label: '⚫ Expired' },
  { key: 'warning', label: '🟡 Soon' },
  { key: 'safe', label: '🟢 Fresh' }
];

const CATEGORY_EMOJIS = {
  Dairy: '🥛', Produce: '🥬', Meat: '🥩', Grains: '🌾', Canned: '🥫',
  Condiments: '🧂', Frozen: '❄️', Beverages: '🥤', Snacks: '🍿', Other: '📦'
};

export default function Dashboard({ items, onItemClick, onDeleteItem, onAddClick, aiSummary }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [recipeStage, setRecipeStage] = useState('idle'); // idle | select | loading | result
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [recipes, setRecipes] = useState([]);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return items;
    return items.filter(item => item.status === activeFilter);
  }, [items, activeFilter]);

  // Default selection: all expiring/expired items as required
  const openRecipeSelector = () => {
    const defaultSelected = new Set(
      items.filter(i => i.status === 'expired' || i.status === 'warning').map(i => i._id)
    );
    if (defaultSelected.size === 0) {
      items.slice(0, 5).forEach(i => defaultSelected.add(i._id));
    }
    setSelectedIds(defaultSelected);
    setRecipes([]);
    setRecipeStage('select');
  };

  const toggleItem = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generateRecipes = async () => {
    setRecipeStage('loading');
    try {
      const requiredItemIds = [...selectedIds];
      const optionalItemIds = items.filter(i => !selectedIds.has(i._id)).map(i => i._id);

      const res = await fetch(`${API_BASE}/ai/recipe-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requiredItemIds, optionalItemIds })
      });
      if (res.ok) {
        const data = await res.json();
        const parts = (data.recipe || '').split(/\n---\n|\n---$|^---\n|^---$/m);
        setRecipes(parts.filter(p => p.trim()));
      } else {
        setRecipes(['Could not generate a recipe right now. Try again!']);
      }
    } catch (error) {
      setRecipes(['Could not generate a recipe right now. Try again!']);
    }
    setRecipeStage('result');
  };

  const selectedItems = useMemo(
    () => items.filter(i => selectedIds.has(i._id)),
    [items, selectedIds]
  );

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
            <button key={f.key}
              className={`filter-tab ${activeFilter === f.key ? 'active' : ''}`}
              onClick={() => setActiveFilter(f.key)}
              id={`filter-${f.key}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-ghost recipe-btn" onClick={openRecipeSelector}
            disabled={items.length === 0} id="recipe-btn">
            🍳 What can I cook?
          </button>
          <button className="btn btn-primary add-btn" onClick={onAddClick} id="add-item-btn">
            <span className="plus-icon">+</span> Add Item
          </button>
        </div>
      </div>

      {/* Recipe Selector Panel */}
      {recipeStage === 'select' && (
        <div className="recipe-panel">
          <div className="recipe-header">
            <div className="ai-label">
              <span className="ai-sparkle">🍳</span>
              Select required ingredients
            </div>
            <button className="btn btn-ghost regenerate-btn" onClick={() => setRecipeStage('idle')}>✕</button>
          </div>
          <p className="recipe-selector-hint">
            Checked items are <strong>required</strong> — the AI must use all of them. Unchecked pantry items may be used as extras.
          </p>
          <div className="recipe-item-grid">
            {items.map(item => (
              <label key={item._id} className={`recipe-item-chip ${selectedIds.has(item._id) ? 'selected required' : ''} ${item.status}`}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(item._id)}
                  onChange={() => toggleItem(item._id)}
                />
                <span>{CATEGORY_EMOJIS[item.category] || '📦'}</span>
                <span>{item.name}</span>
                {selectedIds.has(item._id) && <span className="required-badge">required</span>}
              </label>
            ))}
          </div>
          <div className="recipe-selector-footer">
            <span className="recipe-count">
              {selectedIds.size} required ingredient{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <button className="btn btn-primary" onClick={generateRecipes} disabled={selectedIds.size === 0}>
              ✨ Generate Recipes
            </button>
          </div>
        </div>
      )}

      {/* Recipe Loading */}
      {recipeStage === 'loading' && (
        <div className="recipe-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', color: 'var(--text-muted)' }}>
            <div className="spinner"></div>
            <span>Crafting recipes using {selectedIds.size} required ingredient{selectedIds.size !== 1 ? 's' : ''}...</span>
          </div>
        </div>
      )}

      {/* Recipe Results */}
      {recipeStage === 'result' && (
        <div className="recipe-panel">
          <div className="recipe-header">
            <div className="ai-label">
              <span className="ai-sparkle">🍳</span>
              Recipe Suggestions ({recipes.length})
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-ghost regenerate-btn" onClick={() => setRecipeStage('select')}>
                ← Change Ingredients
              </button>
              <button className="btn btn-ghost regenerate-btn" onClick={generateRecipes}>
                🔄 New Recipes
              </button>
              <button className="btn btn-ghost regenerate-btn" onClick={() => setRecipeStage('idle')}>✕</button>
            </div>
          </div>
          <div className="recipe-cards">
            {recipes.map((recipe, i) => (
              <div key={i} className="recipe-card">
                <p className="ai-text" style={{ whiteSpace: 'pre-line' }}>{recipe.trim()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items Grid */}
      {filtered.length > 0 ? (
        <div className="items-grid">
          {filtered.map((item, i) => (
            <ItemCard key={item._id} item={item} onClick={onItemClick}
              onDelete={onDeleteItem} index={i} />
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
