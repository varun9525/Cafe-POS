import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash, 
  CheckCircle,
  X,
  CreditCard,
  QrCode,
  Download,
  Printer,
  ChevronRight,
  Sparkles,
  ArrowRight
} from 'lucide-react';

function SelfService() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  
  // Checkout & Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('UPI QR'); // UPI QR, Debit Card, Credit Card
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  
  // Success states
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [createdOrderDetails, setCreatedOrderDetails] = useState(null);

  // Load products & categories
  const loadPOSData = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
      setFilteredProducts(data);

      const catRes = await fetch('/api/categories');
      const catData = await catRes.json();
      setCategories(catData);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  useEffect(() => {
    loadPOSData();
  }, []);

  // Filter products by category
  useEffect(() => {
    if (activeCategory === 'all') {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter(p => p.category === activeCategory));
    }
  }, [activeCategory, products]);

  // Cart Management
  const addToCart = (product) => {
    if (product.stock <= 0) {
      alert(`Sorry, ${product.name} is currently out of stock.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert(`Limit reached. Only ${product.stock} items left.`);
          return prev;
        }
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setShowCart(true);
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
        alert(`Sorry, only ${existing.stock} items available.`);
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

  // Calculations
  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };
  const getTax = () => getSubtotal() * 0.08;
  const getTotal = () => getSubtotal() + getTax();

  // Dynamic UPI Payment payload
  const getUPIString = () => {
    const totalAmount = getTotal().toFixed(2);
    return `upi://pay?pa=cafe@ybl&pn=OdooCafeCustomer&am=${totalAmount}&cu=INR&tn=KioskRef-${Date.now().toString().slice(-6)}`;
  };

  // Perform backend Checkout
  const handleCheckoutSubmit = async (e) => {
    if (e) e.preventDefault();
    if (cart.length === 0) return;

    if (paymentMethod !== 'UPI QR') {
      if (!cardHolder.trim() || !cardNumber.trim() || !cardExpiry.trim() || !cardCVV.trim()) {
        alert('Please complete all card credential fields.');
        return;
      }
    }

    try {
      const subtotal = getSubtotal();
      const tax = getTax();
      const total = getTotal();

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: 1, 
          items: cart.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity
          })),
          subtotal,
          tax,
          total,
          status: 'To Cook',
          payment_status: 'Paid',
          payment_method: paymentMethod
        }),
      });

      if (!response.ok) {
        throw new Error('Transaction recording failed.');
      }

      const orderData = await response.json();
      setCreatedOrderDetails(orderData);

      setCart([]);
      setShowCart(false);
      setShowPaymentModal(false);
      
      setOrderCompleted(true);
      
      setCardHolder('');
      setCardNumber('');
      setCardExpiry('');
      setCardCVV('');
    } catch (err) {
      alert(err.message);
    }
  };

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
              font-size: 18px;
              font-weight: 800;
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
            <div class="logo">Odoo Cafe Kiosk</div>
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
              <span>Self-Service Kiosk</span>
            </div>
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

  return (
    <div className={`bg-[#f8f9fa] text-[#191c1d] min-h-screen flex flex-col font-sans relative transition-all duration-300 ${
      showCart ? 'lg:pr-[384px]' : ''
    }`}>
      <header className="relative w-full h-[320px] min-h-[280px] overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent z-10"></div>
        <img 
          alt="Welcome to Odoo Cafe" 
          className="absolute inset-0 w-full h-full object-cover" 
          src="https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1000" 
        />
        <div className="absolute top-4 right-4 z-20">
          <button 
            onClick={() => {
              localStorage.removeItem('user');
              window.location.href = '/login';
            }}
            className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold border border-white/20 transition-all active:scale-95"
          >
            Staff Login
          </button>
        </div>
        <div className="absolute bottom-0 left-0 p-8 md:p-12 z-20">
          <div className="flex items-center gap-2 mb-2 bg-[#714B67] text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest w-max">
            <Sparkles size={11} />
            <span>Self Service Kiosk</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white">Welcome to Odoo Cafe</h1>
          <p className="text-white/80 text-xs md:text-sm mt-1.5 max-w-lg">Order fresh craft brews and breakfast delights instantly.</p>
        </div>
      </header>

      <nav className="sticky top-0 z-40 bg-white shadow-sm overflow-x-auto flex items-center px-6 md:px-12 py-3.5 gap-6 hide-scrollbar border-b border-[#E9ECEF] shrink-0">
        <button 
          onClick={() => setActiveCategory('all')}
          className="flex flex-col items-center gap-1 group active:scale-95 transition-transform shrink-0"
        >
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
            activeCategory === 'all' 
              ? 'bg-[#714B67] text-white shadow' 
              : 'bg-[#f3f4f5] text-gray-500 group-hover:bg-[#714B67]/10'
          }`}>
            <ShoppingBag size={18} />
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${
            activeCategory === 'all' ? 'text-[#714B67]' : 'text-gray-500'
          }`}>All Items</span>
        </button>

        {categories.map((cat) => (
          <button 
            key={cat.id} 
            onClick={() => setActiveCategory(cat.name)}
            className="flex flex-col items-center gap-1 group active:scale-95 transition-transform shrink-0"
          >
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
              activeCategory === cat.name 
                ? 'bg-[#714B67] text-white shadow' 
                : 'bg-[#f3f4f5] text-gray-500 group-hover:bg-[#714B67]/10'
            }`}>
              <span className="w-3.5 h-3.5 rounded-full border border-white" style={{ backgroundColor: cat.color }}></span>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              activeCategory === cat.name ? 'text-[#714B67]' : 'text-gray-500'
            }`}>{cat.name}</span>
          </button>
        ))}
      </nav>

      <main className="flex-grow p-6 md:p-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <article 
              key={product.id} 
              className="bg-white rounded-2xl border border-[#E9ECEF] overflow-hidden shadow-sm flex flex-col group transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="h-44 relative overflow-hidden bg-gray-50">
                <img 
                  alt={product.name} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                  src={product.image || 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500'} 
                />
                <span className="absolute bottom-2 right-2 bg-white px-2.5 py-1 rounded-xl font-black text-sm text-[#714B67] shadow-sm">
                  ₹{product.price.toFixed(2)}
                </span>
                {product.stock === 0 && (
                  <span className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-black text-xs uppercase tracking-wider">
                    Sold Out
                  </span>
                )}
              </div>
              <div className="p-5 flex flex-col flex-grow justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">{product.category}</span>
                  <h3 className="font-extrabold text-sm text-gray-900 mt-0.5 mb-1.5">{product.name}</h3>
                  <p className="text-gray-500 text-xs leading-normal line-clamp-2">{product.description || 'No description available'}</p>
                </div>
                
                <button 
                  disabled={product.stock === 0}
                  className="w-full mt-4 py-3 bg-[#714B67] hover:bg-[#57344f] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed" 
                  onClick={() => addToCart(product)}
                >
                  <span>Select Item</span>
                  <Plus size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>

      {cart.length > 0 && !showCart && (
        <div className="fixed bottom-6 right-6 z-50">
          <button 
            onClick={() => setShowCart(true)}
            className="relative bg-[#017E84] text-white px-6 py-4 rounded-full shadow-lg flex items-center gap-2.5 active:scale-95 transition-all hover:shadow-xl hover:-translate-y-0.5"
          >
            <ShoppingBag size={18} />
            <span className="font-bold text-xs uppercase tracking-wider">Review Order</span>
            <span className="bg-[#ba1a1a] text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border border-white font-bold">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          </button>
        </div>
      )}

      <div className={`fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-[60] transform transition-transform duration-300 flex flex-col ${
        showCart ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="p-4 border-b border-[#E9ECEF] flex justify-between items-center bg-[#f8f9fa]">
          <h2 className="font-extrabold text-sm text-[#714B67] uppercase tracking-wider">Your Basket</h2>
          <button className="p-2 hover:bg-[#e7e8e9] rounded-full text-gray-500" onClick={() => setShowCart(false)}>
            <X size={18} />
          </button>
        </div>
        
        <div className="flex-grow overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
          {cart.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3.5 bg-[#f3f4f5] rounded-2xl border">
              <div className="flex-grow min-w-0">
                <h4 className="font-bold text-xs text-gray-900 truncate">{item.name}</h4>
                <span className="text-[#714B67] font-bold text-xs">₹{(item.price * item.quantity).toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1 bg-white rounded-xl border p-0.5">
                <button 
                  onClick={() => updateQuantity(item.id, -1)}
                  className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <Minus size={12} />
                </button>
                <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                <button 
                  onClick={() => updateQuantity(item.id, 1)}
                  className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-[#f8f9fa] border-t border-[#E9ECEF] space-y-4 shrink-0">
          <div className="flex justify-between items-center text-xs text-gray-500 font-bold">
            <span>Sales Tax (8%)</span>
            <span>₹{getTax().toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center border-t border-dashed pt-3">
            <span className="font-bold text-sm text-gray-900">Total Bill</span>
            <span className="font-black text-lg text-[#714B67]">₹{getTotal().toFixed(2)}</span>
          </div>
          <button 
            onClick={() => { setShowCart(false); setShowPaymentModal(true); }}
            className="w-full py-4 bg-[#714B67] hover:bg-[#57344f] text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-[0.98]"
          >
            <span>Proceed to Payment</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {showCart && (
        <div className="fixed inset-0 bg-black/40 z-[55] transition-opacity lg:hidden" onClick={() => setShowCart(false)}></div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[520px]">
            <div className="w-full md:w-5/12 bg-[#f8f9fa] border-r border-gray-100 p-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h3 className="font-extrabold text-sm text-[#714B67] uppercase tracking-wider">Select Payment Mode</h3>
                  <p className="text-[11px] text-gray-500">Pick a payment source for checkout.</p>
                </div>

                <div className="space-y-2.5">
                  <button
                    onClick={() => setPaymentMethod('UPI QR')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                      paymentMethod === 'UPI QR'
                        ? 'border-[#714B67] bg-purple-50/20 text-[#714B67] font-black'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <QrCode size={16} />
                    <span className="text-xs">UPI QR Code Scans</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('Debit Card')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                      paymentMethod === 'Debit Card'
                        ? 'border-[#714B67] bg-purple-50/20 text-[#714B67] font-black'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <CreditCard size={16} />
                    <span className="text-xs">Debit Card</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('Credit Card')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                      paymentMethod === 'Credit Card'
                        ? 'border-[#714B67] bg-purple-50/20 text-[#714B67] font-black'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <CreditCard size={16} />
                    <span className="text-xs">Credit Card</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t">
                <span className="text-[11px] text-gray-400 font-bold block uppercase">Grand Total due:</span>
                <span className="text-2xl font-black text-[#714B67]">₹{getTotal().toFixed(2)}</span>
              </div>
            </div>

            <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3 shrink-0">
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700">{paymentMethod} Gateway</h4>
                <button className="text-gray-400 hover:text-gray-700 font-bold" onClick={() => setShowPaymentModal(false)}>Cancel</button>
              </div>

              <div className="flex-grow flex flex-col items-center justify-center p-4">
                {paymentMethod === 'UPI QR' ? (
                  <div className="text-center space-y-4">
                    <p className="font-bold text-xs text-gray-600">Scan code on your mobile device</p>
                    <div className="w-[180px] h-[180px] bg-white border rounded-2xl flex items-center justify-center p-2 mx-auto shadow-sm">
                      <img 
                        alt="UPI Payment QR" 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getUPIString())}`} 
                        className="w-full h-full"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Transaction will verify on scan completion</p>
                  </div>
                ) : (
                  <form onSubmit={handleCheckoutSubmit} className="w-full max-w-sm space-y-3.5 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Card Holder Name</label>
                      <input 
                        type="text" 
                        placeholder="John Doe"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        className="w-full border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#714B67]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Card Number</label>
                      <input 
                        type="text" 
                        placeholder="4111 2222 3333 4444"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#714B67] text-center tracking-wider"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Expiry Date</label>
                        <input 
                          type="text" 
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full border rounded-xl px-3 py-2.5 text-center"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">CVV code</label>
                        <input 
                          type="password" 
                          placeholder="***"
                          value={cardCVV}
                          onChange={(e) => setCardCVV(e.target.value)}
                          className="w-full border rounded-xl px-3 py-2.5 text-center"
                          maxLength={3}
                          required
                        />
                      </div>
                    </div>
                  </form>
                )}
              </div>

              <button
                onClick={handleCheckoutSubmit}
                className="w-full py-4 bg-[#714B67] hover:bg-[#57344f] text-white font-bold text-xs rounded-xl shadow uppercase shrink-0 transition-colors"
              >
                Confirm Payment & Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {orderCompleted && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl flex flex-col items-center space-y-5">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center text-green-500">
              <CheckCircle size={36} className="stroke-[2.5]" />
            </div>
            
            <div>
              <h3 className="text-xl font-black text-gray-900">Order Confirmed!</h3>
              <p className="text-gray-500 text-xs mt-1">Your order has been sent to the kitchen. Please pick up your ticket below.</p>
            </div>

            <div className="bg-[#f8f9fa] border rounded-2xl p-4 w-full text-left text-xs font-semibold space-y-1.5">
              <div className="flex justify-between font-black text-gray-700 border-b pb-1">
                <span>Receipt Summary</span>
                <span>#POS-${createdOrderDetails?.id || 'Ref'}</span>
              </div>
              <div className="space-y-1 text-gray-500 text-[11px] max-h-24 overflow-y-auto custom-scrollbar">
                {createdOrderDetails?.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.quantity}x {item.name}</span>
                    <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed pt-2 flex justify-between font-bold text-[#714B67]">
                <span>Total Settled</span>
                <span>₹{createdOrderDetails?.total?.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <button
                onClick={() => printReceiptPDF(createdOrderDetails)}
                className="flex-1 py-3 border border-[#714B67] hover:bg-purple-50 text-[#714B67] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download size={14} />
                <span>Save Bill PDF</span>
              </button>
              
              <button
                onClick={() => {
                  setOrderCompleted(false);
                  setCreatedOrderDetails(null);
                  loadPOSData();
                }}
                className="flex-1 py-3 bg-[#714B67] hover:bg-[#57344f] text-white rounded-xl text-xs font-bold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SelfService;
