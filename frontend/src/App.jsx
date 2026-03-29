import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AddItemForm from './components/AddItemForm';
import ItemModal from './components/ItemModal';

const API_BASE = '/api';

const DEFAULT_CATEGORIES = ['Dairy', 'Produce', 'Meat', 'Grains', 'Canned', 'Condiments', 'Frozen', 'Beverages', 'Snacks', 'Other'];

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  // Fetch all items
  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/items`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch AI dashboard summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/ai/dashboard-summary`);
      if (res.ok) {
        const data = await res.json();
        setAiSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  }, []);

  // Fetch categories from backend
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    fetchSummary();
    fetchCategories();
  }, [fetchItems, fetchSummary, fetchCategories]);

  // Add a custom category
  const handleAddCategory = useCallback(async (name) => {
    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        setCategories(prev => [...prev, name]);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error adding category:', error);
      return false;
    }
  }, []);

  // Handle adding a new item (from form or photo upload)
  const handleItemAdded = useCallback((newItem) => {
    setItems(prev => {
      const updated = [...prev, newItem];
      updated.sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));
      return updated;
    });
    fetchSummary();
  }, [fetchSummary]);

  // Handle updating an item
  const handleUpdateItem = useCallback(async (id, updates) => {
    try {
      const res = await fetch(`${API_BASE}/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updatedItem = await res.json();
        setItems(prev => {
          const updated = prev.map(item => item._id === id ? updatedItem : item);
          updated.sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));
          return updated;
        });
        setSelectedItem(updatedItem);
      }
    } catch (error) {
      console.error('Error updating item:', error);
    }
  }, []);

  // Handle deleting an item
  const handleDeleteItem = useCallback(async (id) => {
    try {
      const res = await fetch(`${API_BASE}/items/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems(prev => prev.filter(item => item._id !== id));
        if (selectedItem && selectedItem._id === id) {
          setSelectedItem(null);
        }
        fetchSummary();
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  }, [selectedItem, fetchSummary]);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedItem) setSelectedItem(null);
        else if (showAddForm) setShowAddForm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, showAddForm]);

  if (loading) {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="spinner spinner-lg"></div>
          <span className="loading-text">Loading your pantry...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header items={items} />

      <Dashboard
        items={items}
        onItemClick={setSelectedItem}
        onDeleteItem={handleDeleteItem}
        onAddClick={() => setShowAddForm(true)}
        aiSummary={aiSummary}
      />

      {showAddForm && (
        <AddItemForm
          onClose={() => setShowAddForm(false)}
          onItemAdded={handleItemAdded}
          categories={categories}
          onAddCategory={handleAddCategory}
        />
      )}

      {selectedItem && (
        <ItemModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onItemUpdated={handleUpdateItem}
          categories={categories}
        />
      )}
    </div>
  );
}
