import React from 'react';

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

export default function Header({ items }) {
  const counts = items.reduce(
    (acc, item) => {
      if (item.status === 'expired') acc.expired++;
      else if (item.status === 'warning') acc.warning++;
      else acc.safe++;
      return acc;
    },
    { expired: 0, warning: 0, safe: 0 }
  );

  return (
    <header className="header">
      <div className="header-brand">
        <span className="header-logo">🌿</span>
        <h1 className="header-title">ShelfSage</h1>
      </div>
      <p className="header-tagline">
        Never waste a bite. Smart pantry management powered by AI.
      </p>

      {items.length > 0 && (
        <div className="stats-bar">
          <div className="stat-card danger">
            <span className="stat-number">{counts.expired}</span>
            <span>Use Today</span>
          </div>
          <div className="stat-card warning">
            <span className="stat-number">{counts.warning}</span>
            <span>Expiring Soon</span>
          </div>
          <div className="stat-card safe">
            <span className="stat-number">{counts.safe}</span>
            <span>Fresh</span>
          </div>
          <div className="stat-card total">
            <span className="stat-number">{items.length}</span>
            <span>Total Items</span>
          </div>
        </div>
      )}
    </header>
  );
}
