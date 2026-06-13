import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  LogOut, 
  Search, 
  Bell, 
  Settings, 
  UserPlus, 
  ShoppingBag, 
  ArrowRight, 
  Plus, 
  Minus, 
  Trash2,
  AlertTriangle,
  Receipt,
  User,
  Coffee,
  CheckCircle,
  Sparkles,
  CreditCard,
  QrCode,
  Check,
  Send,
  Users,
  Grid,
  Mail,
  Printer,
  ChevronRight,
  BookOpen
} from 'lucide-react';

const apiFetch = async (url, options = {}) => {
  const saved = localStorage.getItem('user');
  let token = null;
  if (saved) {
    try {
      token = JSON.parse(saved).token;
    } catch (e) {}
  }
  
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  
  return fetch(url, { ...options, headers });
};

function CashierTerminal({ user, onLogout }) {
  // Session State
  const [activeSession, setActiveSession] = useState(null);
  const [startBalance, setStartBalance] = useState('');
  const [loadingSession, setLoadingSession] = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [endBalance, setEndBalance] = useState('');
  const [sessionSummary, setSessionSummary] = useState(null);

  // POS State
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [cart, setCart] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null); // Table object
  const [tables, setTables] = useState([]);
  const [showTableModal, setShowTableModal] = useState(false);
  const [activeFloor, setActiveFloor] = useState('Ground Floor');

  const [guestCount, setGuestCount] = useState(1);
  const [note, setNote] = useState('');
  const [stockAlerts, setStockAlerts] = useState([]);
  const [socket, setSocket] = useState(null);

  // Promotions & Coupons state
  const [promotions, setPromotions] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');

  // Customer State
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [custSearchQuery, setCustSearchQuery] = useState('');

  // Payment State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash'); // Cash, Digital/Card, UPI QR
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paidAmount, setPaidAmount] = useState('');
  const [cardRef, setCardRef] = useState('');
  const [isPaidSuccess, setIsPaidSuccess] = useState(false);
  const [createdOrderDetails, setCreatedOrderDetails] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailSentMsg, setEmailSentMsg] = useState('');

  // Fetch active session
  const checkActiveSession = async () => {
    try {
      const res = await apiFetch('/api/sessions/active');
      const data = await res.json();
      if (data) {
        setActiveSession(data);
        fetchSessionSummary(data.id);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error('Error checking active session:', err);
    } finally {
      setLoadingSession(false);
    }
  };

  const fetchSessionSummary = async (sessionId) => {
    try {
      const res = await apiFetch(`/api/sessions/summary/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSessionSummary(data);
      }
    } catch (err) {
      console.error('Error fetching session summary:', err);
    }
  };

  const handleOpenSession = async (e) => {
    e.preventDefault();
    if (!startBalance || isNaN(startBalance)) {
      alert('Please enter a valid starting balance');
      return;
    }
    try {
      const res = await apiFetch('/api/sessions/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_balance: parseFloat(startBalance) })
      });
      if (res.ok) {
        const session = await res.json();
        setActiveSession(session);
        fetchSessionSummary(session.id);
      } else {
        const errData = await res.json();
        alert(`Failed to open session: ${errData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error opening session:', err);
      alert('Network error occurred while opening session.');
    }
  };

  const handleCloseSession = async () => {
    if (!endBalance || isNaN(endBalance)) {
      alert('Please enter a valid closing balance');
      return;
    }
    try {
      const res = await apiFetch('/api/sessions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeSession.id, end_balance: parseFloat(endBalance) })
      });
      if (res.ok) {
        alert('Session closed successfully.');
        setShowCloseModal(false);
        setActiveSession(null);
        setEndBalance('');
        onLogout();
      }
    } catch (err) {
      console.error('Error closing session:', err);
    }
  };

  // Load essential POS metadata
  const loadPOSData = async () => {
    try {
      const prodRes = await apiFetch('/api/products');
      const prodData = await prodRes.json();
      setProducts(prodData);
      setFilteredProducts(prodData);

      const catRes = await apiFetch('/api/categories');
      const catData = await catRes.json();
      setCategories(catData);

      const tableRes = await apiFetch('/api/tables');
      const tableData = await tableRes.json();
      setTables(tableData);

      const custRes = await apiFetch('/api/customers');
      const custData = await custRes.json();
      setCustomers(custData);

      const promoRes = await apiFetch('/api/promotions');
      const promoData = await promoRes.json();
      setPromotions(promoData.filter(p => p.active === 1));

      const payRes = await apiFetch('/api/payment-methods');
      const payData = await payRes.json();
      setPaymentMethods(payData.filter(p => p.enabled === 1));
    } catch (err) {
      console.error('Error loading POS data:', err);
    }
  };

  useEffect(() => {
    checkActiveSession();
    loadPOSData();

    // Setup Socket
    const newSocket = io({ auth: { token: user?.token } });
    setSocket(newSocket);

    newSocket.on('inventory_alert', (alert) => {
      setStockAlerts((prev) => {
        if (prev.find((p) => p.name === alert.name)) return prev;
        return [...prev, alert];
      });
      loadPOSData(); // Reload stock
    });

    newSocket.on('force_logout', (data) => {
      alert(data.message || 'You have been logged out.');
      onLogout();
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Filter products
  useEffect(() => {
    let result = products;
    if (activeCategory !== 'all') {
      result = result.filter(p => p.category === activeCategory);
    }
    if (searchQuery.trim() !== '') {
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    setFilteredProducts(result);
  }, [activeCategory, searchQuery, products]);

  // Cart logic
  const addToCart = (product) => {
    if (product.stock <= 0) {
      alert(`Sorry, ${product.name} is out of stock.`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert(`Cannot add more. Only ${product.stock} units left in stock.`);
          return prev;
        }
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, delta) => {
    setCart((prev) => {
      const existing = prev.find(item => item.id === productId);
      if (!existing) return prev;
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        return prev.filter(item => item.id !== productId);
      }
      if (delta > 0 && newQty > existing.stock) {
        alert(`Cannot exceed available stock (${existing.stock} units).`);
        return prev;
      }
      return prev.map(item => 
        item.id === productId ? { ...item, quantity: newQty } : item
      );
    });
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter(item => item.id !== productId));
  };

  // ------------------ PROMOTION & TOTALS ENGINE ------------------
  const calculateCartTotals = () => {
    let rawSubtotal = 0;
    let itemDiscountsTotal = 0;
    let lineItems = [];

    cart.forEach(item => {
      const lineCost = item.price * item.quantity;
      rawSubtotal += lineCost;

      const matchingPromo = promotions.find(p => p.type === 'product' && p.product_id === item.id);
      let lineDiscount = 0;
      let promoAppliedText = '';

      if (matchingPromo && item.quantity >= matchingPromo.min_qty) {
        if (matchingPromo.discount_type === 'percent') {
          lineDiscount = lineCost * (matchingPromo.value / 100);
          promoAppliedText = `${matchingPromo.name} (-${matchingPromo.value}%)`;
        } else if (matchingPromo.discount_type === 'fixed') {
          lineDiscount = matchingPromo.value * item.quantity;
          promoAppliedText = `${matchingPromo.name} (-₹${matchingPromo.value}/unit)`;
        }
      }

      itemDiscountsTotal += lineDiscount;
      lineItems.push({
        ...item,
        lineCost,
        lineDiscount,
        promoAppliedText
      });
    });

    const subtotalAfterProductPromos = rawSubtotal - itemDiscountsTotal;

    let orderDiscount = 0;
    let orderPromoName = '';
    const orderPromo = promotions.find(p => p.type === 'order' && subtotalAfterProductPromos >= p.min_amount);
    
    if (orderPromo) {
      if (orderPromo.discount_type === 'percent') {
        orderDiscount = subtotalAfterProductPromos * (orderPromo.value / 100);
        orderPromoName = `${orderPromo.name} (-${orderPromo.value}%)`;
      } else if (orderPromo.discount_type === 'fixed') {
        orderDiscount = orderPromo.value;
        orderPromoName = `${orderPromo.name} (-₹${orderPromo.value.toFixed(2)})`;
      }
    }

    const subtotalAfterAllPromos = subtotalAfterProductPromos - orderDiscount;

    let couponDiscount = 0;
    if (appliedCoupon) {
      if (appliedCoupon.discount_type === 'percent') {
        couponDiscount = subtotalAfterAllPromos * (appliedCoupon.value / 100);
      } else if (appliedCoupon.discount_type === 'fixed') {
        couponDiscount = appliedCoupon.value;
      }
    }

    const finalSubtotal = Math.max(0, subtotalAfterAllPromos - couponDiscount);
    const totalDiscount = itemDiscountsTotal + orderDiscount + couponDiscount;
    const taxRate = 0.08; 
    const tax = finalSubtotal * taxRate;
    const total = finalSubtotal + tax;

    return {
      rawSubtotal,
      itemDiscountsTotal,
      orderDiscount,
      orderPromoName,
      couponDiscount,
      totalDiscount,
      finalSubtotal,
      tax,
      total,
      lineItems
    };
  };

  const totals = calculateCartTotals();

  // Coupon handling
  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError('');
    try {
      const res = await apiFetch(`/api/coupons/validate/${couponCode.trim()}`);
      if (res.ok) {
        const coupon = await res.json();
        setAppliedCoupon(coupon);
        setCouponCode('');
      } else {
        const errData = await res.json();
        setCouponError(errData.error || 'Invalid coupon code');
        setAppliedCoupon(null);
      }
    } catch (err) {
      setCouponError('Error validating coupon');
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
  };

  // ------------------ FLOOR & TABLE SELECTION ------------------
  const openTableSelect = () => {
    loadPOSData(); 
    setShowTableModal(true);
  };

  const handleSelectTable = async (table) => {
    setSelectedTable(table);
    setShowTableModal(false);

    if (table.active_order_id) {
      try {
        const res = await apiFetch('/api/orders');
        if (res.ok) {
          const ordersList = await res.json();
          const activeOrder = ordersList.find(o => o.id === table.active_order_id);
          if (activeOrder) {
            setActiveOrderId(activeOrder.id);
            setNote(activeOrder.note || '');
            
            const mappedCart = activeOrder.items.map(item => {
              const baseProd = products.find(p => p.name === item.name) || {};
              return {
                ...baseProd,
                id: baseProd.id || Math.random(),
                name: item.name,
                price: item.price,
                quantity: item.quantity
              };
            });
            setCart(mappedCart);
            
            if (activeOrder.customer_id) {
              const cust = customers.find(c => c.id === activeOrder.customer_id);
              if (cust) setSelectedCustomer(cust);
            } else {
              setSelectedCustomer(null);
            }
            return;
          }
        }
      } catch (err) {
        console.error('Error fetching table order:', err);
      }
    }

    setCart([]);
    setActiveOrderId(null);
    setSelectedCustomer(null);
    setNote('');
  };

  const releaseTable = () => {
    setSelectedTable(null);
    setActiveOrderId(null);
    setCart([]);
    setSelectedCustomer(null);
    setNote('');
  };

  // ------------------ KITCHEN TRANSMISSION ------------------
  const sendToKitchen = async () => {
    if (cart.length === 0) return;
    
    try {
      let orderId = activeOrderId;
      
      if (!orderId) {
        const orderRes = await apiFetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: activeSession ? activeSession.id : 1,
            table_id: selectedTable ? selectedTable.id : null,
            customer_id: selectedCustomer ? selectedCustomer.id : null,
            items: cart.map(item => ({
              name: item.name,
              price: item.price,
              quantity: item.quantity
            })),
            subtotal: totals.finalSubtotal,
            tax: totals.tax,
            discount_amount: totals.totalDiscount,
            total: totals.total,
            status: 'Draft'
          })
        });
        if (!orderRes.ok) throw new Error('Could not create draft order');
        const newOrder = await orderRes.json();
        orderId = newOrder.id;
        setActiveOrderId(orderId);
      } else {
        const updateRes = await apiFetch(`/api/orders/${orderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map(item => ({
              name: item.name,
              price: item.price,
              quantity: item.quantity
            })),
            subtotal: totals.finalSubtotal,
            tax: totals.tax,
            discount_amount: totals.totalDiscount,
            total: totals.total,
            status: 'Draft'
          })
        });
        if (!updateRes.ok) throw new Error('Could not update draft order');
      }

      const kitRes = await apiFetch(`/api/orders/${orderId}/kitchen`, { method: 'POST' });
      if (kitRes.ok) {
        alert('Order successfully sent to kitchen!');
        loadPOSData(); 
      } else {
        alert('Failed to alert kitchen.');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Save as Draft
  const saveAsDraft = async () => {
    if (cart.length === 0) return;
    try {
      const payload = {
        session_id: activeSession ? activeSession.id : 1,
        table_id: selectedTable ? selectedTable.id : null,
        customer_id: selectedCustomer ? selectedCustomer.id : null,
        items: cart.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        subtotal: totals.finalSubtotal,
        tax: totals.tax,
        discount_amount: totals.totalDiscount,
        total: totals.total,
        status: 'Draft'
      };

      let res;
      if (activeOrderId) {
        res = await apiFetch(`/api/orders/${activeOrderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await apiFetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        alert('Draft order saved.');
        setCart([]);
        setActiveOrderId(null);
        setSelectedTable(null);
        setSelectedCustomer(null);
        setNote('');
        loadPOSData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ------------------ CUSTOMER LINKAGE ------------------
  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustName || !newCustEmail) {
      alert('Name and email are required');
      return;
    }
    try {
      const res = await apiFetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustName,
          email: newCustEmail,
          phone: newCustPhone
        })
      });
      if (res.ok) {
        const newCust = await res.json();
        setCustomers(prev => [...prev, newCust]);
        setSelectedCustomer(newCust);
        setNewCustName('');
        setNewCustEmail('');
        setNewCustPhone('');
        setShowCustomerModal(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(custSearchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(custSearchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(custSearchQuery))
  );

  // PDF Receipt Generation
  const printReceiptPDF = (order) => {
    if (!order) return;
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    const itemsHtml = order.items.map(item => `
      <tr style="border-bottom: 1px dashed #E9ECEF; font-size: 13px;">
        <td style="padding: 8px 0; color: #191c1d;">${item.name} x ${item.quantity}</td>
        <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #714B67;">₹${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    const discountHtml = order.discount_amount > 0 ? `
      <div style="display: flex; justify-content: space-between; font-size: 13px; color: #ba1a1a; font-weight: bold; margin-bottom: 4px;">
        <span>Discounts:</span>
        <span>-₹${order.discount_amount.toFixed(2)}</span>
      </div>
    ` : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Odoo Cafe - Invoice #POS-${order.id}</title>
          <style>
            body {
              font-family: 'Inter', sans-serif;
              background: #ffffff;
              color: #191c1d;
              margin: 40px;
              line-height: 1.5;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 24px;
              font-weight: 800;
              color: #714B67;
              margin-bottom: 5px;
            }
            .subtitle {
              font-size: 12px;
              color: #7f8c8d;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-weight: bold;
            }
            .divider {
              border-top: 2px dashed #E9ECEF;
              margin: 20px 0;
            }
            .meta-info {
              font-size: 12px;
              color: #555;
              margin-bottom: 20px;
            }
            .meta-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
            }
            .receipt-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .totals {
              margin-top: 20px;
              background: #f8f9fa;
              padding: 15px;
              border-radius: 12px;
              border: 1px solid #E9ECEF;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              color: #555;
              margin-bottom: 6px;
            }
            .grand-total {
              display: flex;
              justify-content: space-between;
              font-weight: 800;
              font-size: 18px;
              color: #714B67;
              border-top: 1px dashed #d1c3ca;
              padding-top: 8px;
              margin-top: 8px;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              font-size: 11px;
              color: #95a5a6;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">Odoo Cafe POS</div>
            <div class="subtitle">Official Receipt & Bill Invoice</div>
          </div>

          <div class="meta-info">
            <div class="meta-row">
              <span>Invoice Ref:</span>
              <span style="font-weight: bold; color: #714B67;">#POS-${order.id}</span>
            </div>
            <div class="meta-row">
              <span>Date & Time:</span>
              <span>${new Date(order.created_at || Date.now()).toLocaleString()}</span>
            </div>
            <div class="meta-row">
              <span>Station:</span>
              <span>Cashier Terminal</span>
            </div>
            ${order.table_id ? `
            <div class="meta-row">
              <span>Table:</span>
              <span>Table ${order.table_id}</span>
            </div>
            ` : ''}
          </div>

          <div class="divider"></div>

          <table class="receipt-table">
            <thead>
              <tr style="border-bottom: 2px solid #714B67; text-align: left; font-size: 11px; font-weight: bold; color: #7f8c8d; text-transform: uppercase;">
                <th style="padding-bottom: 8px;">Menu Item</th>
                <th style="padding-bottom: 8px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <span>Subtotal:</span>
              <span>₹${order.subtotal.toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span>Tax (8%):</span>
              <span>₹${order.tax.toFixed(2)}</span>
            </div>
            ${discountHtml}
            <div class="grand-total">
              <span>Grand Total:</span>
              <span>₹${order.total.toFixed(2)}</span>
            </div>
          </div>

          <div style="margin-top: 15px; font-size: 11px; text-align: center; color: #7f8c8d; font-weight: bold;">
            Paid via ${order.payment_method}
          </div>

          <div class="divider"></div>

          <div class="footer">
            <p>Thank you for dining at Odoo Cafe!</p>
            <p>This is a computer-generated invoice document.</p>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ------------------ CHECKOUT / KEYPAD & UPI QR ------------------
  const openPaymentModal = () => {
    if (cart.length === 0) return;
    setPaidAmount(totals.total.toFixed(2));
    setCardRef('');
    setIsPaidSuccess(false);
    setEmailSentMsg('');
    setEmailInput(selectedCustomer ? selectedCustomer.email : '');
    setShowPaymentModal(true);
  };

  const handleKeypadPress = (val) => {
    if (val === '.') {
      if (!paidAmount.includes('.')) setPaidAmount(prev => prev + '.');
    } else {
      if (paidAmount === totals.total.toFixed(2)) {
        setPaidAmount(val);
      } else {
        setPaidAmount(prev => prev + val);
      }
    }
  };

  const handleBackspace = () => {
    setPaidAmount(prev => prev.slice(0, -1));
  };

  const getUPIString = () => {
    const upiMethod = paymentMethods.find(p => p.name === 'UPI QR');
    const merchantUPI = upiMethod ? upiMethod.upi_id : 'cafe@ybl';
    return `upi://pay?pa=${merchantUPI}&pn=OdooCafe&am=${totals.total.toFixed(2)}&cu=INR&tn=OrderRef-${Date.now().toString().slice(-6)}`;
  };

  const confirmCheckout = async () => {
    const paid = parseFloat(paidAmount) || 0;
    if (paymentMethod === 'Cash' && paid < totals.total) {
      alert(`Insufficient cash provided. Need at least ₹${totals.total.toFixed(2)}`);
      return;
    }

    try {
      const payload = {
        session_id: activeSession ? activeSession.id : 1,
        table_id: selectedTable ? selectedTable.id : null,
        customer_id: selectedCustomer ? selectedCustomer.id : null,
        items: cart.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        subtotal: totals.finalSubtotal,
        tax: totals.tax,
        discount_amount: totals.totalDiscount,
        total: totals.total,
        status: 'Paid',
        payment_method: paymentMethod + (paymentMethod === 'Card' && cardRef ? ` (Ref: ${cardRef})` : '')
      };

      let res;
      if (activeOrderId) {
        res = await apiFetch(`/api/orders/${activeOrderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await apiFetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        const orderData = await res.json();
        setCreatedOrderDetails(orderData);
        setIsPaidSuccess(true);
        if (activeSession) fetchSessionSummary(activeSession.id);
      } else {
        throw new Error('Transaction recording failed.');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEmailReceipt = async (e) => {
    e.preventDefault();
    if (!emailInput) return;
    try {
      const orderId = createdOrderDetails ? createdOrderDetails.id : (activeOrderId || 1);
      const res = await apiFetch(`/api/orders/${orderId}/email-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput })
      });
      if (res.ok) {
        setEmailSentMsg(`Receipt sent successfully to ${emailInput}!`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resetTerminal = () => {
    setCart([]);
    setActiveOrderId(null);
    setSelectedTable(null);
    setSelectedCustomer(null);
    setNote('');
    setCouponCode('');
    setAppliedCoupon(null);
    setShowPaymentModal(false);
    setIsPaidSuccess(false);
    setCreatedOrderDetails(null);
    loadPOSData(); 
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-t-[#714B67] border-purple-200 rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-gray-500">Checking POS Session...</span>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] text-[#191c1d] flex items-center justify-center font-sans p-6">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-[#E9ECEF] shadow-xl space-y-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#714B67]/10 rounded-2xl flex items-center justify-center text-[#714B67] mb-4">
              <Coffee size={36} />
            </div>
            <h1 className="text-2xl font-black text-[#714B67]">Odoo Cafe POS</h1>
            <p className="text-gray-500 mt-1 text-sm">Welcome back! Please open a new cash drawer register session to begin taking orders.</p>
          </div>

          <form onSubmit={handleOpenSession} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Opening Cash Balance ($)</label>
              <input 
                type="number" 
                step="0.01"
                placeholder="100.00"
                value={startBalance}
                onChange={(e) => setStartBalance(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#E9ECEF] focus:outline-none focus:ring-2 focus:ring-[#714B67] font-semibold text-lg text-center"
                required
              />
            </div>
            <button 
              type="submit"
              className="w-full py-4 bg-[#714B67] text-white rounded-xl font-bold shadow-lg shadow-purple-900/10 hover:bg-[#57344f] transition-all"
            >
              Open Register Session
            </button>
          </form>

          <div className="pt-4 border-t border-[#E9ECEF] text-center">
            <button 
              onClick={onLogout}
              className="text-xs text-gray-400 font-bold hover:text-[#ba1a1a] transition-colors"
            >
              Go Back to Main Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f9fa] text-[#191c1d] overflow-hidden h-screen flex flex-col font-sans">
      <header className="sticky top-0 z-50 flex justify-between items-center w-full px-6 bg-white border-b border-[#E9ECEF] h-16 shrink-0">
        <div className="flex items-center gap-8">
          <span className="text-xl font-extrabold text-[#714B67] tracking-tight">Odoo Cafe POS</span>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-green-50 text-green-700 font-semibold rounded-full text-xs">
              Drawer #{activeSession.id} • Open
            </span>
            {selectedTable && (
              <span className="px-3 py-1 bg-purple-50 text-[#714B67] border border-[#714B67]/20 font-bold rounded-full text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#714B67] animate-pulse"></span>
                Table {selectedTable.table_number} ({selectedTable.floor})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              className="pl-10 pr-4 py-2 bg-[#f3f4f5] rounded-full border-none focus:outline-none focus:ring-2 focus:ring-[#714B67] text-sm w-60" 
              placeholder="Search menu items..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text"
            />
          </div>

          <button 
            onClick={openTableSelect}
            className="flex items-center gap-2 px-3 py-2 bg-[#714B67]/10 hover:bg-[#714B67]/15 text-[#714B67] rounded-xl text-xs font-bold transition-all border border-[#714B67]/10"
          >
            <Grid size={15} />
            <span>Floor Grid</span>
          </button>

          <button 
            className="p-2 text-gray-500 hover:bg-[#f3f4f5] rounded-full transition-colors relative"
            onClick={() => setStockAlerts([])}
          >
            <Bell size={20} />
            {stockAlerts.length > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#ba1a1a] rounded-full"></span>
            )}
          </button>

          <button 
            onClick={() => {
              fetchSessionSummary(activeSession.id);
              setEndBalance((sessionSummary ? (activeSession.start_balance + sessionSummary.totalSales) : activeSession.start_balance).toFixed(2));
              setShowCloseModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-purple-200 text-[#714B67] rounded-lg text-xs font-bold hover:bg-purple-50 transition-colors"
          >
            <span>Close Shift</span>
          </button>
        </div>
      </header>

      {stockAlerts.length > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center justify-between text-xs text-[#ba1a1a]">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={14} />
            <span>Low Stock Warning: {stockAlerts.map(a => `${a.name} (${a.stock} left)`).join(', ')}</span>
          </div>
          <button className="underline hover:text-[#93000a]" onClick={() => setStockAlerts([])}>Dismiss</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col min-w-0 bg-[#f8f9fa]">
          <div className="h-16 shrink-0 border-b border-[#E9ECEF] flex items-center px-6 gap-3 bg-white overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setActiveCategory('all')}
              className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === 'all' 
                  ? 'bg-[#714B67] text-white shadow' 
                  : 'bg-[#f3f4f5] text-gray-600 hover:bg-[#e7e8e9]'
              }`}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button 
                key={cat.id}
                onClick={() => setActiveCategory(cat.name)}
                className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeCategory === cat.name 
                    ? 'bg-[#714B67] text-white shadow' 
                    : 'bg-[#f3f4f5] text-gray-600 hover:bg-[#e7e8e9]'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                {cat.name}
              </button>
            ))}
          </div>

          <div className="flex-grow overflow-y-auto p-6 custom-scrollbar">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <ShoppingBag size={48} className="stroke-[1.5] mb-2 text-gray-300" />
                <p className="text-sm">No products found matching filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredProducts.map((product) => (
                  <div 
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="product-card cursor-pointer bg-white rounded-2xl border border-[#E9ECEF] overflow-hidden shadow-sm flex flex-col group active:scale-[0.98] transition-all relative"
                  >
                    <div className="relative h-28 w-full overflow-hidden bg-gray-50">
                      <img 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        src={product.image || '/images/default_coffee.jpg'} 
                      />
                      <span className="absolute bottom-2 right-2 bg-white px-2 py-0.5 rounded font-black text-xs text-[#714B67] shadow-sm">
                        ₹{product.price.toFixed(2)}
                      </span>
                      {product.stock <= 5 && (
                        <span className="absolute top-2 left-2 bg-[#ba1a1a] text-white px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                          {product.stock === 0 ? 'Out of Stock' : `Low Stock: ${product.stock}`}
                        </span>
                      )}
                    </div>
                    <div className="p-3.5 flex-grow flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">{product.category}</span>
                        </div>
                        <h3 className="font-bold text-xs text-gray-900 leading-tight truncate">{product.name}</h3>
                        <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">{product.description || 'No description'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        <aside className="w-[380px] shrink-0 bg-white border-l border-[#E9ECEF] flex flex-col shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.03)]">
          <div className="p-4 border-b border-[#E9ECEF] flex justify-between items-center bg-[#f8f9fa]">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-extrabold text-sm text-[#714B67] uppercase tracking-wider">Active Order</h2>
                {activeOrderId && <span className="text-[10px] font-bold text-gray-400">#Draft-{activeOrderId}</span>}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {selectedTable ? (
                  <button 
                    onClick={openTableSelect} 
                    className="text-[11px] font-bold text-[#714B67] hover:underline"
                  >
                    Table {selectedTable.table_number} ({selectedTable.floor})
                  </button>
                ) : (
                  <button 
                    onClick={openTableSelect} 
                    className="text-[11px] text-gray-500 font-bold hover:text-[#714B67] flex items-center gap-1"
                  >
                    <span>No Table Linked</span>
                    <ChevronRight size={12} />
                  </button>
                )}

                {selectedTable && (
                  <button onClick={releaseTable} className="text-[10px] text-red-500 hover:underline">
                    Clear Table
                  </button>
                )}
              </div>
            </div>

            <button 
              onClick={() => {
                loadPOSData();
                setShowCustomerModal(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                selectedCustomer 
                  ? 'bg-purple-50 text-[#714B67] border-purple-200' 
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <User size={15} />
              <span className="truncate max-w-[80px]">{selectedCustomer ? selectedCustomer.name : 'Link Customer'}</span>
            </button>
          </div>

          <div className="flex-grow overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                <ShoppingBag size={42} className="mb-2 text-gray-300" />
                <p className="text-xs">Cart is empty</p>
              </div>
            ) : (
              totals.lineItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#f3f4f5] border border-[#E9ECEF]">
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-xs text-gray-900 truncate">{item.name}</span>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-xs text-[#714B67]">₹{item.lineCost.toFixed(2)}</span>
                        {item.lineDiscount > 0 && (
                          <div className="text-[10px] text-green-600 font-bold">-{item.promoAppliedText}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2.5">
                      <div className="flex items-center gap-1 bg-white border border-[#E9ECEF] rounded-lg p-0.5">
                        <button 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="h-5 w-5 rounded bg-[#f3f4f5] flex items-center justify-center text-gray-600 hover:bg-[#714B67] hover:text-white transition-colors"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="px-2 text-xs font-bold text-gray-800">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
                          className="h-5 w-5 rounded bg-[#f3f4f5] flex items-center justify-center text-gray-600 hover:bg-[#714B67] hover:text-white transition-colors"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="h-6 w-6 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="px-4 py-3 border-t border-[#E9ECEF] bg-white space-y-2">
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg text-xs">
                  <span className="font-bold text-green-700">Coupon: {appliedCoupon.code} (-{appliedCoupon.value}{appliedCoupon.discount_type === 'percent' ? '%' : '$'})</span>
                  <button onClick={removeCoupon} className="text-green-700 hover:text-red-600 font-bold">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Coupon Code (e.g. COFFEE10)" 
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="flex-1 text-xs text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#714B67]"
                  />
                  <button 
                    onClick={applyCoupon}
                    className="px-3 py-1.5 bg-[#714B67] hover:bg-[#57344f] text-white font-bold text-xs rounded-lg transition-colors"
                  >
                    Apply
                  </button>
                </div>
              )}
              {couponError && <p className="text-[10px] font-bold text-red-500">{couponError}</p>}
            </div>
          )}

          {cart.length > 0 && (
            <div className="px-4 py-2 border-t border-b border-[#E9ECEF] bg-white">
              <input 
                type="text" 
                placeholder="Kitchen prep instructions..." 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full text-xs text-gray-600 border-none p-1 focus:outline-none focus:ring-0"
              />
            </div>
          )}

          <div className="p-6 bg-[#f8f9fa] border-t border-[#E9ECEF] space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-500 font-bold">
                <span>Subtotal</span>
                <span>₹{totals.rawSubtotal.toFixed(2)}</span>
              </div>
              {totals.itemDiscountsTotal > 0 && (
                <div className="flex justify-between text-xs text-green-600 font-bold">
                  <span>Product Promos</span>
                  <span>-₹{totals.itemDiscountsTotal.toFixed(2)}</span>
                </div>
              )}
              {totals.orderDiscount > 0 && (
                <div className="flex justify-between text-xs text-green-600 font-bold">
                  <span>Order Promo ({totals.orderPromoName})</span>
                  <span>-₹{totals.orderDiscount.toFixed(2)}</span>
                </div>
              )}
              {totals.couponDiscount > 0 && (
                <div className="flex justify-between text-xs text-green-600 font-bold">
                  <span>Coupon Discount</span>
                  <span>-₹{totals.couponDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-gray-500 font-bold">
                <span>Tax (8.0%)</span>
                <span>₹{totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base text-gray-900 pt-2 border-t border-[#E9ECEF] border-dashed font-black">
                <span>Total Due</span>
                <span className="text-[#714B67]">₹{totals.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={saveAsDraft}
                disabled={cart.length === 0}
                className="py-2.5 border border-[#714B67] text-[#714B67] hover:bg-purple-50 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                Save Draft
              </button>
              <button 
                onClick={sendToKitchen}
                disabled={cart.length === 0}
                className="py-2.5 bg-[#017E84] hover:bg-[#016469] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Send size={13} />
                <span>Send Kitchen</span>
              </button>
            </div>

            <button 
              onClick={openPaymentModal}
              disabled={cart.length === 0}
              className="w-full py-3.5 bg-[#714B67] text-white rounded-2xl text-sm font-extrabold shadow-lg shadow-purple-950/10 hover:bg-[#57344f] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Receipt size={16} />
              <span>Checkout Register</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </aside>
      </div>

      {showTableModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 flex flex-col h-[500px]">
            <div className="flex justify-between items-center mb-4 border-b pb-3 shrink-0">
              <div>
                <h3 className="font-extrabold text-lg text-[#714B67]">Select Table Floor Plan</h3>
                <p className="text-xs text-gray-500 mt-0.5">Click a table to begin or retrieve orders.</p>
              </div>
              <button className="text-gray-400 hover:text-gray-800 font-bold" onClick={() => setShowTableModal(false)}>Close</button>
            </div>

            <div className="flex bg-[#f3f4f5] p-1 rounded-xl gap-1 mb-4 shrink-0 border border-gray-100">
              {['Ground Floor', 'First Floor', 'Terrace'].map(floorName => (
                <button
                  key={floorName}
                  onClick={() => setActiveFloor(floorName)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeFloor === floorName ? 'bg-[#714B67] text-white shadow' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {floorName}
                </button>
              ))}
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-1">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                {tables
                  .filter(t => t.floor === activeFloor)
                  .map(table => {
                    const isOccupied = table.status === 'Active' || table.active_order_id;
                    return (
                      <div
                        key={table.id}
                        onClick={() => handleSelectTable(table)}
                        className={`p-4 rounded-2xl border-2 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-1 select-none active:scale-[0.97] ${
                          isOccupied 
                            ? 'bg-purple-50 border-[#714B67] text-[#714B67] shadow-sm shadow-purple-900/5' 
                            : 'bg-white border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50/20'
                        }`}
                      >
                        <span className="text-lg font-black">{table.table_number}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{table.seats} Seats</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase mt-1 ${
                          isOccupied ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {isOccupied ? 'Occupied' : 'Vacant'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 flex flex-col h-[520px]">
            <div className="flex justify-between items-center mb-4 pb-3 border-b shrink-0">
              <h3 className="font-extrabold text-lg text-[#714B67]">Link Customer to Cart</h3>
              <button className="text-gray-400 hover:text-gray-800 font-bold" onClick={() => setShowCustomerModal(false)}>Close</button>
            </div>

            <div className="flex-grow flex flex-col overflow-hidden space-y-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search name, email, or phone..."
                  value={custSearchQuery}
                  onChange={(e) => setCustSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-[#714B67] focus:outline-none"
                />
              </div>

              <div className="flex-1 overflow-y-auto border border-gray-100 rounded-2xl p-2 custom-scrollbar">
                {filteredCustomers.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">No customers found</p>
                ) : (
                  filteredCustomers.map(cust => (
                    <div
                      key={cust.id}
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setShowCustomerModal(false);
                      }}
                      className={`flex justify-between items-center p-3 rounded-xl cursor-pointer hover:bg-purple-50/40 border transition-all ${
                        selectedCustomer && selectedCustomer.id === cust.id 
                          ? 'border-[#714B67] bg-purple-50/20' 
                          : 'border-transparent'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-xs text-gray-900">{cust.name}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{cust.email} • {cust.phone || 'No phone'}</p>
                      </div>
                      <ChevronRight size={14} className="text-gray-400" />
                    </div>
                  ))
                )}
              </div>

              <div className="border-t pt-4">
                <p className="font-bold text-xs text-[#714B67] mb-3">Add New Customer Profile</p>
                <form onSubmit={handleCreateCustomer} className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text" 
                      placeholder="Name" 
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#714B67]"
                    />
                    <input 
                      type="email" 
                      placeholder="Email" 
                      value={newCustEmail}
                      onChange={(e) => setNewCustEmail(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#714B67]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Phone (optional)" 
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#714B67]"
                    />
                    <button 
                      type="submit"
                      className="bg-[#714B67] hover:bg-[#57344f] text-white px-4 py-2 font-bold text-xs rounded-lg transition-colors"
                    >
                      Save & Link
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[560px]">
            <div className="w-full md:w-5/12 bg-[#f8f9fa] border-r border-[#E9ECEF] p-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h3 className="font-extrabold text-md text-[#714B67] uppercase tracking-wider">Checkout Options</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">Select a customer payment source.</p>
                </div>

                <div className="space-y-2">
                  <button 
                    onClick={() => setPaymentMethod('Cash')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                      paymentMethod === 'Cash' 
                        ? 'border-[#714B67] bg-purple-50/30 text-[#714B67] font-black' 
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      ₹
                    </div>
                    <span className="text-xs">Cash Payment</span>
                  </button>

                  <button 
                    onClick={() => setPaymentMethod('Card')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                      paymentMethod === 'Card' 
                        ? 'border-[#714B67] bg-purple-50/30 text-[#714B67] font-black' 
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                      <CreditCard size={15} />
                    </div>
                    <span className="text-xs">Credit/Debit Card</span>
                  </button>

                  <button 
                    onClick={() => setPaymentMethod('UPI QR')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                      paymentMethod === 'UPI QR' 
                        ? 'border-[#714B67] bg-purple-50/30 text-[#714B67] font-black' 
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-[#714B67]">
                      <QrCode size={15} />
                    </div>
                    <span className="text-xs">UPI QR Code</span>
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <div className="flex justify-between items-center text-xs text-gray-500 font-bold mb-1">
                  <span>Gross Order Total:</span>
                  <span>₹{totals.total.toFixed(2)}</span>
                </div>
                <div className="text-xl font-black text-gray-900">
                  Total Due: <span className="text-[#714B67]">₹{totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 p-6 flex flex-col justify-between">
              <div className="flex justify-between items-center shrink-0 border-b pb-3">
                <h4 className="font-bold text-sm text-gray-900">{paymentMethod} details</h4>
                <button 
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-gray-800 font-bold"
                  disabled={isPaidSuccess}
                >
                  Cancel
                </button>
              </div>

              <div className="flex-grow flex flex-col items-center justify-center p-4">
                {isPaidSuccess ? (
                  <div className="w-full max-w-sm border border-[#E9ECEF] rounded-2xl bg-white p-5 space-y-4 shadow-sm text-center">
                    <div className="w-12 h-12 bg-green-500/10 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                      <CheckCircle size={28} />
                    </div>
                    <h5 className="font-extrabold text-sm text-gray-900">Transaction Complete!</h5>
                    <p className="text-[11px] text-gray-500">Order successfully logged and processed.</p>
                    
                    <div className="text-left bg-[#f8f9fa] border rounded-xl p-3.5 space-y-1.5 text-xs font-semibold">
                      <div className="flex justify-between font-bold border-b pb-1 text-gray-700">
                        <span>Odoo Cafe Receipt</span>
                        <span>#POS-{createdOrderDetails?.id || 'Ref'}</span>
                      </div>
                      <div className="space-y-1 text-gray-500 text-[11px]">
                        {createdOrderDetails?.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{item.quantity}x {item.name}</span>
                            <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t pt-1.5 flex justify-between font-bold text-[#714B67]">
                        <span>Total Paid</span>
                        <span>₹{createdOrderDetails?.total?.toFixed(2) || totals.total.toFixed(2)}</span>
                      </div>
                    </div>

                    <form onSubmit={handleEmailReceipt} className="space-y-2">
                      <div className="flex gap-2">
                        <input 
                          type="email" 
                          placeholder="name@customer.com"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-[#714B67] focus:outline-none"
                        />
                        <button 
                          type="submit"
                          className="px-3 bg-[#714B67] text-white rounded-lg text-xs font-bold"
                        >
                          Send Mail
                        </button>
                      </div>
                      {emailSentMsg && <p className="text-[10px] text-green-600 font-bold text-center">{emailSentMsg}</p>}
                    </form>

                    <div className="flex gap-2 justify-center">
                      <button 
                        onClick={() => printReceiptPDF(createdOrderDetails)}
                        className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 flex items-center justify-center gap-1 text-[11px] font-bold"
                      >
                        <Printer size={14} />
                        <span>Print Bill (PDF)</span>
                      </button>
                      <button 
                        onClick={resetTerminal}
                        className="flex-1 py-2 bg-[#714B67] hover:bg-[#57344f] text-white rounded-xl text-[11px] font-bold transition-colors"
                      >
                        Start Next Order
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {paymentMethod === 'Cash' && (
                      <div className="flex flex-col items-center w-full max-w-sm space-y-4">
                        <div className="text-center">
                          <p className="text-xs text-gray-500 font-bold">ENTER CASH RECEIVED</p>
                          <div className="text-2xl font-black text-[#714B67] mt-1 bg-[#f3f4f5] px-6 py-2 rounded-xl border">
                            ₹{paidAmount || '0.00'}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 w-full max-w-[280px]">
                          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((num) => (
                            <button 
                              key={num}
                              onClick={() => handleKeypadPress(num)}
                              className="h-10 rounded-xl bg-[#f3f4f5] hover:bg-gray-200 text-xs font-black text-gray-800"
                            >
                              {num}
                            </button>
                          ))}
                          <button 
                            onClick={handleBackspace}
                            className="h-10 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 flex items-center justify-center text-xs font-bold"
                          >
                            Del
                          </button>
                        </div>

                        <div className="text-center font-bold text-xs">
                          {parseFloat(paidAmount) >= totals.total ? (
                            <span className="text-green-600">
                              Change Due: ₹{(parseFloat(paidAmount) - totals.total).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-red-500">
                              Remaining: ₹{(totals.total - (parseFloat(paidAmount) || 0)).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'Card' && (
                      <div className="text-center space-y-5 max-w-xs">
                        <div className="w-12 h-12 bg-blue-500/10 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                          <CreditCard size={24} />
                        </div>
                        <div>
                          <p className="font-extrabold text-sm text-gray-800">Swipe Card on Terminal Device</p>
                          <p className="text-[11px] text-gray-400 mt-1">Submit the external card reader invoice transaction reference number below.</p>
                        </div>
                        <input 
                          type="text" 
                          placeholder="Reference Code (e.g. TXN-94285)"
                          value={cardRef}
                          onChange={(e) => setCardRef(e.target.value)}
                          className="w-full border rounded-xl px-4 py-2.5 text-xs text-center focus:ring-1 focus:ring-[#714B67]"
                        />
                      </div>
                    )}

                    {paymentMethod === 'UPI QR' && (
                      <div className="text-center space-y-4">
                        <p className="font-bold text-xs text-gray-700">Scan QR Code using UPI Apps</p>
                        <div className="w-[180px] h-[180px] bg-white border border-[#E9ECEF] rounded-2xl flex items-center justify-center p-2.5 mx-auto">
                          <img 
                            alt="UPI QR Code Payment" 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getUPIString())}`} 
                            className="w-full h-full"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-black text-gray-900">₹{totals.total.toFixed(2)}</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Scans instantly using PhonePe, GPay, Paytm</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {!isPaidSuccess && (
                <button
                  onClick={confirmCheckout}
                  className="w-full py-4 bg-[#714B67] hover:bg-[#57344f] text-white font-bold text-xs rounded-xl shadow-lg uppercase transition-all"
                >
                  Process & Mark Paid
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCloseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 flex flex-col space-y-6">
            <div className="text-center">
              <h3 className="font-extrabold text-lg text-[#ba1a1a]">Close Register Shift Drawer</h3>
              <p className="text-xs text-gray-500 mt-1">Verify shift balance counts prior to closure.</p>
            </div>

            <div className="bg-[#f8f9fa] border border-[#E9ECEF] rounded-2xl p-4 space-y-2.5 text-xs font-bold text-gray-600">
              <div className="flex justify-between">
                <span>Start cash balance:</span>
                <span>₹{activeSession.start_balance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Shift paid sales (Cash/Card):</span>
                <span>+₹{(sessionSummary?.totalSales || 0.0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-gray-900 text-sm">
                <span>Expected Drawer Total:</span>
                <span>₹{(activeSession.start_balance + (sessionSummary?.totalSales || 0.0)).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500">Actual Closing cash balance (₹)</label>
              <input 
                type="number"
                step="0.01"
                value={endBalance}
                onChange={(e) => setEndBalance(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#714B67] font-semibold text-center text-sm"
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setShowCloseModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-50"
              >
                Go Back
              </button>
              <button 
                onClick={handleCloseSession}
                className="flex-1 py-2.5 bg-[#ba1a1a] hover:bg-[#93000a] text-white rounded-lg text-xs font-bold"
              >
                Close Register
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CashierTerminal;
