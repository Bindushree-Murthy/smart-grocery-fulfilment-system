import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function App() {
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isRemoveMode, setIsRemoveMode] = useState(false);

  const [restockProduct, setRestockProduct] = useState('');
  const [restockQty, setRestockQty] = useState(10);

  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Snacks & Biscuits');
  const [customCategory, setCustomCategory] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newStock, setNewStock] = useState('');

  const [feedback, setFeedback] = useState(null);

  const fetchStoreData = async () => {
    try {
      const [invRes, ordRes] = await Promise.all([
        axios.get('http://127.0.0.1:5000/api/inventory'),
        axios.get('http://127.0.0.1:5000/api/orders')
      ]);
      setInventory(invRes.data);
      setOrders(ordRes.data);
      if (invRes.data.length > 0 && !restockProduct) {
        setRestockProduct(invRes.data[0].product_id);
      }
    } catch (err) {
      console.error("Data fetch error", err);
    }
  };

  useEffect(() => {
    fetchStoreData();
    const interval = setInterval(fetchStoreData, 2000);
    return () => clearInterval(interval);
  }, []);

  const addItemToCart = (item) => {
    if (isRemoveMode) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === item.product_id);
      const currentCartQty = existing ? existing.quantity : 0;

      if (currentCartQty >= item.stock_quantity) {
        alert(`Cannot add more. Only ${item.stock_quantity} in stock!`);
        return prev;
      }

      if (existing) {
        return prev.map((c) =>
          c.product_id === item.product_id ? { ...c, quantity: c.quantity + 1 } : c
        );
      } else {
        return [...prev, { product_id: item.product_id, name: item.name, price: item.price, quantity: 1, stock_quantity: item.stock_quantity }];
      }
    });
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.product_id !== id));
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    try {
      const res = await axios.post('http://127.0.0.1:5000/api/orders/checkout', { items: cart });
      setFeedback({ type: 'success', text: `✓ ${res.data.message}` });
      setCart([]);
      fetchStoreData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || "Order placement failed" });
    }
  };

  const handleDeleteProduct = async (productId, productName, price) => {
    if (!window.confirm(`Delete '${productName} (₹${price.toFixed(2)})' from inventory?`)) return;
    try {
      await axios.delete(`http://127.0.0.1:5000/api/inventory/${productId}`);
      setFeedback({ type: 'success', text: `✓ Deleted '${productName}'` });
      setCart((prev) => prev.filter((c) => c.product_id !== productId));
      fetchStoreData();
    } catch (err) {
      setFeedback({ type: 'error', text: "Failed to delete item." });
    }
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://127.0.0.1:5000/api/inventory/add', {
        product_id: Number(restockProduct),
        quantity: Number(restockQty)
      });
      setFeedback({ type: 'success', text: `✓ ${res.data.message}` });
      fetchStoreData();
    } catch (err) {
      setFeedback({ type: 'error', text: "Failed to restock" });
    }
  };

  const handleCreateNewProduct = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newPrice || !newStock) {
      setFeedback({ type: 'error', text: "Please enter product name, price, and initial stock." });
      return;
    }

    const finalCategory = newCategory === 'CUSTOM' ? (customCategory.trim() || 'General') : newCategory;

    try {
      const res = await axios.post('http://127.0.0.1:5000/api/inventory/new-product', {
        name: newName.trim(),
        category: finalCategory,
        price: Number(newPrice),
        initial_stock: Number(newStock)
      });
      setFeedback({ type: 'success', text: `✓ ${res.data.message}` });
      setNewName('');
      setNewPrice('');
      setNewStock('');
      setCustomCategory('');
      fetchStoreData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || "Failed to register product" });
    }
  };

  const cartTotal = cart.reduce((sum, itm) => sum + itm.price * itm.quantity, 0);
  const totalStoreUnits = inventory.reduce((sum, itm) => sum + itm.stock_quantity, 0);

  // Filter items by category and quick search
  const filteredInventory = inventory.filter((item) => {
    const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Group into category boxes
  const groupedCategories = filteredInventory.reduce((groups, item) => {
    const cat = item.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
    return groups;
  }, {});

  const allCategories = ['ALL', ...Array.from(new Set(inventory.map((i) => i.category || 'General')))];
  const criticalItems = inventory.filter((i) => i.stock_quantity > 0 && i.stock_quantity <= 2);
  const refillWarningItems = inventory.filter((i) => i.stock_quantity > 2 && i.stock_quantity <= 5);

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px 20px', color: '#1e293b' }}>

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', color: '#0f172a' }}>🛒 Kirana & Supermarket Smart Fulfilment POS</h1>
          <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '13px' }}>
            Scale: {inventory.length} Catalog Items | {totalStoreUnits.toLocaleString()} Units in Stock
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setIsRemoveMode(!isRemoveMode)}
            style={{
              background: isRemoveMode ? '#16a34a' : '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 14px',
              fontWeight: 'bold',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {isRemoveMode ? "✓ Done (Exit Remove Mode)" : "🗑️ Remove Items"}
          </button>
        </div>
      </header>

      {/* Warnings */}
      {criticalItems.length > 0 && (
        <div style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px' }}>
          🚨 GOING TO BE OUT OF STOCK: {criticalItems.map((i) => `${i.name} (₹${i.price.toFixed(2)}) - ${i.stock_quantity} left`).join(', ')}
        </div>
      )}

      {refillWarningItems.length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', padding: '8px 12px', borderRadius: '6px', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
          ⚠️ REFILL WARNING (Stock ≤ 5): {refillWarningItems.map((i) => `${i.name} (₹${i.price.toFixed(2)}) - ${i.stock_quantity} left`).join(', ')}
        </div>
      )}

      {feedback && (
        <div style={{ background: feedback.type === 'success' ? '#dcfce7' : '#fee2e2', color: feedback.type === 'success' ? '#15803d' : '#991b1b', padding: '8px 12px', borderRadius: '6px', marginBottom: '10px', fontWeight: 'bold', fontSize: '12px' }}>
          {feedback.text}
        </div>
      )}

      {/* Search & Category Filter Navigation */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔎 Quick search 250 items (e.g. Milk, Atta, Red Label)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: '240px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
        />
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                background: selectedCategory === cat ? '#0284c7' : '#e2e8f0',
                color: selectedCategory === cat ? '#fff' : '#334155',
                border: 'none',
                borderRadius: '16px',
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '18px', marginBottom: '18px' }}>

        {/* Left Column: Categorized Outerline Boxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '78vh', overflowY: 'auto', paddingRight: '6px' }}>
          {Object.keys(groupedCategories).length === 0 ? (
            <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', textAlign: 'center', color: '#94a3b8' }}>
              No products found matching "{searchQuery}".
            </div>
          ) : (
            Object.entries(groupedCategories).map(([categoryName, items]) => (

              /* ENCLOSED AISLE BOX PER CATEGORY */
              <div
                key={categoryName}
                style={{
                  background: '#ffffff',
                  border: '2px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '14px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}
              >
                {/* 1st Line: Category Name Header */}
                <div style={{
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#0f172a',
                  borderBottom: '2px solid #f1f5f9',
                  paddingBottom: '6px',
                  marginBottom: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{categoryName}</span>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>
                    {items.length} items
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                  {items.map((item) => {
                    const isZero = item.stock_quantity === 0;
                    const isCritical = item.stock_quantity > 0 && item.stock_quantity <= 2;
                    const isRefill = item.stock_quantity > 2 && item.stock_quantity <= 5;

                    const inCart = cart.find(c => c.product_id === item.product_id)?.quantity || 0;
                    const availableLeft = item.stock_quantity - inCart;

                    return (
                      <div
                        key={item.product_id}
                        onClick={() => !isZero && !isRemoveMode && addItemToCart(item)}
                        style={{
                          position: 'relative',
                          border: isCritical ? '2px solid #ef4444' : (isRefill ? '2px solid #f59e0b' : '1px solid #e2e8f0'),
                          borderRadius: '6px',
                          padding: '10px',
                          background: '#fff',
                          cursor: isRemoveMode ? 'default' : (isZero ? 'not-allowed' : 'pointer'),
                          overflow: 'hidden'
                        }}
                      >
                        {isRemoveMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProduct(item.product_id, item.name, item.price);
                            }}
                            style={{
                              position: 'absolute',
                              top: '4px',
                              right: '4px',
                              background: '#dc2626',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '50%',
                              width: '20px',
                              height: '20px',
                              fontWeight: 'bold',
                              fontSize: '11px',
                              cursor: 'pointer',
                              zIndex: 25,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            ✕
                          </button>
                        )}

                        {isZero && (
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(241, 245, 249, 0.94)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 10
                          }}>
                            <div style={{ background: '#dc2626', color: '#fff', padding: '3px 10px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px', transform: 'rotate(-8deg)' }}>
                              SOLD OUT
                            </div>
                            <span style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', fontWeight: 'bold' }}>Out of Stock</span>
                          </div>
                        )}

                        <div style={{ fontSize: '12px', fontWeight: 'bold', minHeight: '32px' }}>{item.name}</div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', margin: '3px 0' }}>₹{item.price.toFixed(2)}</div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <div>
                            <span style={{
                              fontSize: '12px',
                              fontWeight: 'bold',
                              color: isZero ? '#94a3b8' : (isCritical ? '#dc2626' : (isRefill ? '#d97706' : '#16a34a'))
                            }}>
                              {item.stock_quantity} in stock
                            </span>
                            {inCart > 0 && (
                              <div style={{ fontSize: '10px', color: '#2563eb', fontWeight: 'bold' }}>
                                ({inCart} in order)
                              </div>
                            )}
                          </div>

                          {!isRemoveMode && (
                            <button
                              disabled={isZero || availableLeft <= 0}
                              style={{
                                background: isZero || availableLeft <= 0 ? '#cbd5e1' : '#2563eb',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '10px',
                                cursor: isZero || availableLeft <= 0 ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              + Select
                            </button>
                          )}
                        </div>

                        {isCritical && (
                          <div style={{ marginTop: '4px', background: '#fee2e2', color: '#dc2626', fontSize: '9px', padding: '2px', borderRadius: '3px', fontWeight: 'bold', textAlign: 'center' }}>
                            GOING TO BE OUT OF STOCK!
                          </div>
                        )}

                        {isRefill && (
                          <div style={{ marginTop: '4px', background: '#fef3c7', color: '#b45309', fontSize: '9px', padding: '2px', borderRadius: '3px', fontWeight: 'bold', textAlign: 'center' }}>
                            ⚠️ Refill Warning (≤ 5 items)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Column: Order Cart, Restock, and New Product */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Active Cart */}
          <div style={{ background: '#fff', padding: '14px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '14px', margin: '0 0 8px', color: '#0f172a' }}>🛍️ Current Order Items</h2>

            {cart.length === 0 ? (
              <div style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', border: '2px dashed #e2e8f0', borderRadius: '6px' }}>
                Click <strong>+ Select</strong> on any product to bill.
              </div>
            ) : (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '8px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '4px 0' }}>Item</th>
                      <th style={{ padding: '4px 0' }}>Qty</th>
                      <th style={{ padding: '4px 0' }}>Price</th>
                      <th style={{ padding: '4px 0' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((itm) => (
                      <tr key={itm.product_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '4px 0', fontWeight: 'bold' }}>{itm.name}</td>
                        <td style={{ padding: '4px 0' }}>{itm.quantity}</td>
                        <td style={{ padding: '4px 0' }}>₹{(itm.price * itm.quantity).toFixed(2)}</td>
                        <td style={{ padding: '4px 0', textAlign: 'right' }}>
                          <button
                            onClick={() => removeFromCart(itm.product_id)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #e2e8f0', paddingTop: '6px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Total Bill:</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#16a34a' }}>₹{cartTotal.toFixed(2)}</span>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  style={{ width: '100%', padding: '9px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
                >
                  Place Order (Deducts Stock Now)
                </button>
              </div>
            )}
          </div>

          {/* Restock Existing Product */}
          <div style={{ background: '#fff', padding: '14px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '13px', color: '#047857' }}>➕ Restock Existing Item</h3>
            <form onSubmit={handleRestock} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px', color: '#64748b' }}>Select Item</label>
                <select
                  value={restockProduct}
                  onChange={(e) => setRestockProduct(e.target.value)}
                  style={{ width: '100%', padding: '6px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                >
                  {inventory.map((item) => (
                    <option key={item.product_id} value={item.product_id}>
                      {item.name} (₹{item.price.toFixed(2)}) — Stock: {item.stock_quantity}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ width: '55px' }}>
                <label style={{ fontSize: '10px', color: '#64748b' }}>Units</label>
                <input
                  type="number"
                  min="1"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  style={{ width: '100%', padding: '5px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                />
              </div>

              <button
                type="submit"
                style={{ padding: '6px 12px', background: '#059669', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}
              >
                + Add
              </button>
            </form>
          </div>

          {/* Add Newly Arrived Product */}
          <div style={{ background: '#fff', padding: '14px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '13px', color: '#0284c7' }}>✨ Add Newly Arrived Product</h3>
            <form onSubmit={handleCreateNewProduct} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>
                <label style={{ fontSize: '10px', color: '#64748b' }}>Product Name</label>
                <input
                  type="text"
                  placeholder="e.g. Marie Gold Biscuits (200g)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ width: '95%', padding: '6px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', color: '#64748b' }}>Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  style={{ width: '98%', padding: '6px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                >
                  <option value="Dairy & Cold Storage">Dairy & Cold Storage</option>
                  <option value="Atta, Rice & Grains">Atta, Rice & Grains</option>
                  <option value="Snacks & Biscuits">Snacks & Biscuits</option>
                  <option value="Tea, Coffee & Beverages">Tea, Coffee & Beverages</option>
                  <option value="Oils & Ghee">Oils & Ghee</option>
                  <option value="Spices & Cooking Essentials">Spices & Cooking Essentials</option>
                  <option value="Personal Care & Household">Personal Care & Household</option>
                  <option value="CUSTOM">+ Type New Category...</option>
                </select>
              </div>

              {newCategory === 'CUSTOM' && (
                <div>
                  <label style={{ fontSize: '10px', color: '#64748b' }}>New Category Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Frozen Foods, Fresh Produce"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    style={{ width: '95%', padding: '5px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: '#64748b' }}>Price (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="30.00"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    style={{ width: '90%', padding: '5px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: '#64748b' }}>Stock Units</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="25"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    style={{ width: '90%', padding: '5px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{ marginTop: '4px', padding: '8px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
              >
                + Register Product
              </button>
            </form>
          </div>

        </div>

      </div>

      {/* Sales Register */}
      <div style={{ background: '#fff', padding: '14px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: '14px', margin: '0 0 8px', color: '#0f172a' }}>📋 Order History Tracking</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
              <th style={{ padding: '5px' }}>Order #</th>
              <th style={{ padding: '5px' }}>Items Sold</th>
              <th style={{ padding: '5px' }}>Total Units</th>
              <th style={{ padding: '5px' }}>Total Bill</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>
                  No orders placed yet.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '5px', fontWeight: 'bold' }}>#{o.id}</td>
                  <td style={{ padding: '5px' }}>{o.items_summary.join(', ')}</td>
                  <td style={{ padding: '5px', fontWeight: 'bold', color: '#0284c7' }}>{o.units_sold} items</td>
                  <td style={{ padding: '5px', fontWeight: 'bold' }}>₹{o.total_amount.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}