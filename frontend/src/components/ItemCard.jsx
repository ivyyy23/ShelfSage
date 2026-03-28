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

function getStatusClass(status) {
  if (status === 'expired') return 'status-expired';
  if (status === 'warning') return 'status-warning';
  return 'status-safe';
}

function getExpiryLabel(daysUntilExpiry) {
  if (daysUntilExpiry < 0) return `Expired ${Math.abs(daysUntilExpiry)} day${Math.abs(daysUntilExpiry) !== 1 ? 's' : ''} ago`;
  if (daysUntilExpiry === 0) return 'Expires today!';
  if (daysUntilExpiry === 1) return 'Expires tomorrow';
  if (daysUntilExpiry <= 7) return `Expires in ${daysUntilExpiry} days`;
  return `${daysUntilExpiry} days remaining`;
}

function getExpiryColorClass(status) {
  if (status === 'expired') return 'danger';
  if (status === 'warning') return 'warning';
  return 'safe';
}

function getBadgeClass(status) {
  if (status === 'expired') return 'badge badge-danger';
  if (status === 'warning') return 'badge badge-warning';
  return 'badge badge-safe';
}

function getStatusLabel(status) {
  if (status === 'expired') return 'Use Today';
  if (status === 'warning') return 'Use Soon';
  return 'Fresh';
}

export default function ItemCard({ item, onClick, onDelete, index }) {
  const statusClass = getStatusClass(item.status);
  const expiryLabel = getExpiryLabel(item.daysUntilExpiry);
  const colorClass = getExpiryColorClass(item.status);
  const emoji = CATEGORY_EMOJIS[item.category] || '📦';

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(item._id);
  };

  return (
    <div
      className={`glass-card item-card ${statusClass}`}
      onClick={() => onClick(item)}
      style={{ animationDelay: `${index * 0.05}s` }}
      role="button"
      tabIndex={0}
      id={`item-card-${item._id}`}
    >
      <button
        className="btn btn-danger delete-btn"
        onClick={handleDelete}
        title="Remove item"
        aria-label={`Delete ${item.name}`}
      >
        ✕
      </button>

      <div className="item-card-header">
        <span className="item-name">{item.name}</span>
        <span className={getBadgeClass(item.status)}>
          {getStatusLabel(item.status)}
        </span>
      </div>

      <div className="item-card-meta">
        <span className="category-badge">
          {emoji} {item.category}
        </span>
        <span className="item-quantity">Qty: {item.quantity}</span>
      </div>

      <div className="item-expiry">
        <span className={`expiry-text ${colorClass}`}>
          {expiryLabel}
        </span>
      </div>
    </div>
  );
}
