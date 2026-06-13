import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  Utensils, 
  LayoutDashboard, 
  Inbox, 
  BarChart3, 
  Users, 
  Settings as SettingsIcon, 
  Bell, 
  User, 
  DollarSign, 
  FileSpreadsheet, 
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  ArrowRight,
  Coffee,
  CheckCircle2,
  Trash2,
  Edit3,
  Plus,
  Sliders,
  Grid,
  Percent,
  Check,
  Download,
  CreditCard,
  QrCode
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

function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview'); 
  const [stats, setStats] = useState({
    todaySales: 0,
    ordersToday: 0,
    stockAlerts: [],
    topProduct: { name: 'None', count: 0 },
    weeklySales: [
      { day: 'Mon', total: 0 },
      { day: 'Tue', total: 0 },
      { day: 'Wed', total: 0 },
      { day: 'Thu', total: 0 },
      { day: 'Fri', total: 0 },
      { day: 'Sat', total: 0 },
      { day: 'Sun', total: 0 }
    ]
  });
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  const [reportPeriod, setReportPeriod] = useState('Today');
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Form states
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodCategory, setProdCategory] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodUom, setProdUom] = useState('pcs');
  const [prodTax, setProdTax] = useState('8.0');
  const [prodStock, setProdStock] = useState('50');

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#714B67');

  const [showTableModal, setShowTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [tableNumber, setTableNumber] = useState('');
  const [tableSeats, setTableSeats] = useState('4');
  const [tableFloor, setTableFloor] = useState('Ground Floor');

  const [showCouponModal, setShowCouponModal] = useState(false);
  const [coupCode, setCoupCode] = useState('');
  const [coupType, setCoupType] = useState('percent');
  const [coupValue, setCoupValue] = useState('');

  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoName, setPromoName] = useState('');
  const [promoType, setPromoType] = useState('product'); 
  const [promoMinQty, setPromoMinQty] = useState('0');
  const [promoMinAmount, setPromoMinAmount] = useState('0');
  const [promoDiscType, setPromoDiscType] = useState('percent');
  const [promoValue, setPromoValue] = useState('');
  const [promoProductId, setPromoProductId] = useState('');

  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empUsername, setEmpUsername] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [empRole, setEmpRole] = useState('cashier');

  const fetchDashboardData = async () => {
    try {
      const statsRes = await apiFetch('/api/dashboard/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      const ordersRes = await apiFetch('/api/orders');
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData);
      }

      const prodRes = await apiFetch('/api/products');
      if (prodRes.ok) setProducts(await prodRes.json());

      const catRes = await apiFetch('/api/categories');
      if (catRes.ok) setCategories(await catRes.json());

      const tableRes = await apiFetch('/api/tables');
      if (tableRes.ok) setTables(await tableRes.json());

      const coupRes = await apiFetch('/api/coupons');
      if (coupRes.ok) setCoupons(await coupRes.json());

      const promoRes = await apiFetch('/api/promotions');
      if (promoRes.ok) setPromotions(await promoRes.json());

      const payRes = await apiFetch('/api/payment-methods');
      if (payRes.ok) setPaymentMethods(await payRes.json());

      const empRes = await apiFetch('/api/employees');
      if (empRes.ok) setEmployees(await empRes.json());

    } catch (err) {
      console.error('Error fetching dashboard entities:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    generateCustomReport('Today');

    const socket = io({ auth: { token: user?.token } });
    socket.on('new_order', () => fetchDashboardData());
    socket.on('order_updated', () => fetchDashboardData());
    socket.on('inventory_alert', () => fetchDashboardData());
    socket.on('force_logout', (data) => {
      alert(data.message || 'You have been logged out.');
      onLogout();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const markAsPaid = async (orderId) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Paid' })
      });
      if (res.ok) fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  // ------------------ PRODUCTS CRUD ------------------
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: prodName,
      price: parseFloat(prodPrice),
      category: prodCategory || categories[0]?.name || 'Coffee',
      image: prodImage,
      description: prodDesc,
      uom: prodUom,
      tax: parseFloat(prodTax),
      stock: parseInt(prodStock)
    };

    try {
      let res;
      if (editingProduct) {
        res = await apiFetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await apiFetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setShowProductModal(false);
        setEditingProduct(null);
        resetProductForm();
        fetchDashboardData();
      } else {
        const errData = await res.json();
        alert(`Failed to save product: ${errData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error occurred while saving product.');
    }
  };

  const startEditProduct = (prod) => {
    setEditingProduct(prod);
    setProdName(prod.name || '');
    setProdPrice(prod.price !== null && prod.price !== undefined ? prod.price.toString() : '');
    setProdCategory(prod.category || '');
    setProdImage(prod.image || '');
    setProdDesc(prod.description || '');
    setProdUom(prod.uom || 'pcs');
    setProdTax(prod.tax !== null && prod.tax !== undefined ? prod.tax.toString() : '8.0');
    setProdStock(prod.stock !== null && prod.stock !== undefined ? prod.stock.toString() : '50');
    setShowProductModal(true);
  };

  const deleteProduct = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDashboardData();
      } else {
        const errData = await res.json();
        alert(`Failed to delete product: ${errData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error occurred while deleting product.');
    }
  };

  const resetProductForm = () => {
    setProdName('');
    setProdPrice('');
    setProdCategory(categories[0]?.name || '');
    setProdImage('');
    setProdDesc('');
    setProdUom('pcs');
    setProdTax('8.0');
    setProdStock('50');
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setProdImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // ------------------ CATEGORIES CRUD ------------------
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    try {
      let res;
      if (editingCategory) {
        res = await apiFetch(`/api/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catName, color: catColor })
        });
      } else {
        res = await apiFetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catName, color: catColor })
        });
      }
      if (res.ok) {
        setShowCategoryModal(false);
        setEditingCategory(null);
        setCatName('');
        setCatColor('#714B67');
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEditCategory = (cat) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatColor(cat.color);
    setShowCategoryModal(true);
  };

  const deleteCategory = async (id) => {
    if (!confirm('Delete this category?')) return;
    try {
      const res = await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  // ------------------ TABLES CRUD ------------------
  const handleTableSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      table_number: tableNumber,
      seats: parseInt(tableSeats),
      floor: tableFloor
    };
    try {
      let res;
      if (editingTable) {
        res = await apiFetch(`/api/tables/${editingTable.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await apiFetch('/api/tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      if (res.ok) {
        setShowTableModal(false);
        setEditingTable(null);
        setTableNumber('');
        setTableSeats('4');
        setTableFloor('Ground Floor');
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ------------------ COUPONS & PROMOTIONS ------------------
  const handleCouponSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: coupCode.toUpperCase(),
          discount_type: coupType,
          value: parseFloat(coupValue)
        })
      });
      if (res.ok) {
        setShowCouponModal(false);
        setCoupCode('');
        setCoupValue('');
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePromoSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: promoName,
          type: promoType,
          min_qty: parseInt(promoMinQty) || 0,
          min_amount: parseFloat(promoMinAmount) || 0.0,
          discount_type: promoDiscType,
          value: parseFloat(promoValue),
          product_id: promoType === 'product' ? parseInt(promoProductId) : null
        })
      });
      if (res.ok) {
        setShowPromoModal(false);
        setPromoName('');
        setPromoMinQty('0');
        setPromoMinAmount('0');
        setPromoValue('');
        setPromoProductId('');
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const togglePromoStatus = async (promo) => {
    try {
      const res = await apiFetch(`/api/promotions/${promo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: promo.active === 1 ? 0 : 1 })
      });
      if (res.ok) fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  // ------------------ PAYMENT OPTIONS TOGGLE ------------------
  const togglePaymentMethod = async (method) => {
    try {
      const res = await apiFetch(`/api/payment-methods/${method.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: method.enabled === 1 ? 0 : 1, upi_id: method.upi_id })
      });
      if (res.ok) fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const updateUPI = async (method, newUpi) => {
    try {
      await apiFetch(`/api/payment-methods/${method.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: method.enabled, upi_id: newUpi })
      });
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  // ------------------ EMPLOYEES CRUD ------------------
  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: empName,
          username: empUsername,
          password: empPassword,
          role: empRole
        })
      });
      if (res.ok) {
        setShowEmployeeModal(false);
        setEmpName('');
        setEmpUsername('');
        setEmpPassword('');
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteEmployee = async (id) => {
    if (!confirm('Archive this barista account?')) return;
    try {
      const res = await apiFetch(`/api/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true })
      });
      if (res.ok) fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  // ------------------ SALES REPORTS / EXPORTS ------------------
  const generateCustomReport = async (period) => {
    setReportPeriod(period);
    setLoadingReport(true);
    try {
      const res = await apiFetch('/api/reports/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period })
      });
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReport(false);
    }
  };

  const exportReportCSV = () => {
    if (!reportData) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Metric,Value\n";
    csvContent += `Period,${reportPeriod}\n`;
    csvContent += `Total Sales Revenue,${reportData.revenue.toFixed(2)}\n`;
    csvContent += `Total Orders,${reportData.totalOrders}\n`;
    csvContent += `Avg Order Value,${reportData.avgOrderValue.toFixed(2)}\n\n`;

    csvContent += "Top Product Sold,Quantity Sold,Revenue\n";
    reportData.topProducts.forEach(p => {
      csvContent += `"${p.name}",${p.quantitySold},${p.revenue.toFixed(2)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `OdooCafe_POS_Report_${reportPeriod.replace(' ', '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-[#f8f9fa] text-[#191c1d] overflow-x-hidden min-h-screen font-sans flex flex-col">
      <div className="flex flex-1">
        <aside className="hidden lg:flex flex-col h-screen w-64 fixed left-0 top-0 bg-white border-r border-[#E9ECEF] py-6 space-y-3 z-50 shrink-0">
          <div className="px-6 mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#714B67] rounded-xl flex items-center justify-center text-white">
                <Utensils size={20} />
              </div>
              <div>
                <h1 className="font-extrabold text-sm text-[#714B67] uppercase tracking-wider">Odoo Manager</h1>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Main Terminal</p>
              </div>
            </div>
          </div>
          
          <nav className="flex-1 space-y-1">
            {[
              { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
              { id: 'products', label: 'Products Catalog', icon: <Coffee size={18} /> },
              { id: 'categories', label: 'Categories & Colors', icon: <Inbox size={18} /> },
              { id: 'tables', label: 'Floor Table Map', icon: <Grid size={18} /> },
              { id: 'promotions', label: 'Coupons & Promos', icon: <Percent size={18} /> },
              { id: 'payments', label: 'Payment Options', icon: <CreditCard size={18} /> },
              { id: 'employees', label: 'Barista Staff', icon: <Users size={18} /> },
              { id: 'reports', label: 'Shift Sales Reports', icon: <BarChart3 size={18} /> }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-6 py-3 text-xs font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-[#714B67]/10 text-[#714B67] border-l-4 border-[#714B67]' 
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <span className="mr-3">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="px-6 pt-4 border-t border-[#E9ECEF]">
            <button 
              onClick={onLogout}
              className="w-full bg-[#714B67] text-white py-2.5 rounded-xl text-xs font-bold hover:bg-[#57344f] active:scale-95 duration-100 transition-transform"
            >
              Sign Out Manager
            </button>
          </div>
        </aside>

        <main className="lg:ml-64 flex-grow min-h-screen flex flex-col bg-[#f8f9fa] w-full">
          <header className="sticky top-0 z-40 flex justify-between items-center w-full px-8 py-4 bg-white border-b border-[#E9ECEF]">
            <h2 className="text-sm font-black text-[#714B67] uppercase tracking-widest">
              Manager Panel &bull; {activeTab.replace('_', ' ')}
            </h2>
            <div className="flex items-center space-x-3">
              <button 
                className="p-2 text-gray-500 hover:bg-[#f3f4f5] rounded-full transition-colors"
                onClick={fetchDashboardData}
              >
                <RefreshCw size={16} />
              </button>
              <div className="h-4 w-[1px] bg-gray-200"></div>
              <span className="text-xs font-bold text-gray-500">{user.name} (Store Lead)</span>
            </div>
          </header>

          <div className="p-8 max-w-[1600px] mx-auto w-full space-y-8 flex-grow">
            {activeTab === 'overview' && (
              <div className="space-y-8 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white border border-[#E9ECEF] p-6 rounded-2xl relative overflow-hidden shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Today Sales Revenue</p>
                    <h3 className="text-2xl font-black text-gray-900">₹{(stats.todaySales || 0).toFixed(2)}</h3>
                    <div className="flex items-center mt-3 text-emerald-600 font-bold text-[10px] gap-1">
                      <TrendingUp size={12} />
                      <span>Live shift tracking</span>
                    </div>
                  </div>

                  <div className="bg-white border border-[#E9ECEF] p-6 rounded-2xl relative overflow-hidden shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Orders Processed</p>
                    <h3 className="text-2xl font-black text-gray-900">{stats.ordersToday || 0}</h3>
                    <p className="text-[10px] text-gray-400 font-bold mt-3 uppercase">From Cashier Registers</p>
                  </div>

                  <div className="bg-white border border-[#E9ECEF] p-6 rounded-2xl relative overflow-hidden shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Top Selling Item</p>
                    <h3 className="text-xl font-black text-gray-900 truncate">
                      {stats.topProduct?.name || 'None'}
                    </h3>
                    <p className="text-[10px] text-gray-500 font-bold mt-3">
                      {stats.topProduct?.count || 0} units sold today
                    </p>
                  </div>

                  <div className={`border p-6 rounded-2xl relative overflow-hidden shadow-sm transition-colors ${
                    stats.stockAlerts?.length > 0 ? 'bg-red-50/50 border-red-200 text-red-700' : 'bg-white border-[#E9ECEF]'
                  }`}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1">Low Stock Alerts</p>
                    <h3 className="text-2xl font-black">
                      {stats.stockAlerts?.length > 0 ? `${stats.stockAlerts.length} Products Low` : 'All Good'}
                    </h3>
                    <p className="text-[10px] text-gray-400 font-bold mt-3 uppercase">
                      {stats.stockAlerts?.length > 0 ? 'Action required in Inventory tab' : 'Stock levels adequate'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white border border-[#E9ECEF] p-6 rounded-2xl h-[420px] flex flex-col justify-between shadow-sm">
                    <div>
                      <h4 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Weekly Revenue Tracking</h4>
                      <p className="text-[11px] text-gray-400 font-bold">Daily gross income chart</p>
                    </div>
                    <div className="flex-1 w-full relative flex items-end justify-between gap-4 px-4 pb-4 pt-12">
                      {(() => {
                        const weeklySalesData = stats.weeklySales || [
                          { day: 'Mon', total: 0 },
                          { day: 'Tue', total: 0 },
                          { day: 'Wed', total: 0 },
                          { day: 'Thu', total: 0 },
                          { day: 'Fri', total: 0 },
                          { day: 'Sat', total: 0 },
                          { day: 'Sun', total: 0 }
                        ];
                        const maxSale = Math.max(...weeklySalesData.map(s => s.total), 0);
                        return weeklySalesData.map((bar, i) => {
                          const pct = maxSale > 0 ? (bar.total / maxSale) * 100 : 0;
                          return (
                            <div key={i} className="w-full flex flex-col items-center group relative h-full justify-end">
                              <div className="absolute -top-5 text-[9px] font-bold text-[#714B67] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                ₹{bar.total.toFixed(2)}
                              </div>
                              <div className="w-full bg-purple-50 rounded-t-md relative h-full flex items-end overflow-hidden group-hover:bg-purple-100/55 transition-all">
                                <div className="w-full bg-[#714B67] rounded-t-md transition-all" style={{ height: `${pct}%` }}></div>
                              </div>
                              <span className="text-[10px] text-gray-500 font-bold mt-2">{bar.day}</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  <div className="bg-white border border-[#E9ECEF] rounded-2xl overflow-hidden flex flex-col h-[420px] shadow-sm">
                    <div className="p-6 border-b border-[#E9ECEF] shrink-0">
                      <h4 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Recent Invoices</h4>
                    </div>
                    <div className="flex-grow overflow-y-auto custom-scrollbar">
                      {orders.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                          No orders registered yet.
                        </div>
                      ) : (
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-[#f8f9fa] sticky top-0 text-[10px] font-bold text-gray-500 uppercase border-b">
                            <tr>
                              <th className="px-4 py-2.5">Invoice</th>
                              <th className="px-4 py-2.5">Total</th>
                              <th className="px-4 py-2.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E9ECEF] text-xs font-semibold text-gray-700">
                            {orders.slice(0, 10).map((order) => (
                              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3">
                                  <p className="font-black text-gray-900">#POS-{order.id}</p>
                                  <p className="text-[9px] text-gray-400 font-bold uppercase">{order.status}</p>
                                </td>
                                <td className="px-4 py-3 text-[#714B67] font-bold">₹{order.total.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right">
                                  {order.status === 'Paid' ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold uppercase">
                                      Settled
                                    </span>
                                  ) : (
                                    <button 
                                      onClick={() => markAsPaid(order.id)}
                                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[9px] font-bold uppercase transition-colors"
                                    >
                                      Mark Paid
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'products' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-[#E9ECEF] shadow-sm">
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Product Catalog</h3>
                    <p className="text-xs text-gray-400 font-bold">Configure recipe listings, prices, tax percentages</p>
                  </div>
                  <button 
                    onClick={() => { resetProductForm(); setEditingProduct(null); setShowProductModal(true); }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#714B67] hover:bg-[#57344f] text-white rounded-xl text-xs font-bold transition-all shadow-md"
                  >
                    <Plus size={14} />
                    <span>Add Product</span>
                  </button>
                </div>

                <div className="bg-white border border-[#E9ECEF] rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#f8f9fa] text-[10px] font-bold text-gray-400 uppercase border-b">
                      <tr>
                        <th className="px-6 py-3">Product Name</th>
                        <th className="px-6 py-3">Category</th>
                        <th className="px-6 py-3">Unit Price</th>
                        <th className="px-6 py-3">Available Stock</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E9ECEF] text-xs font-semibold text-gray-700">
                      {products.map((prod) => (
                        <tr key={prod.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <img 
                                src={prod.image || '/images/default_coffee.jpg'} 
                                alt={prod.name} 
                                className="w-9 h-9 rounded-lg object-cover bg-gray-100" 
                              />
                              <div>
                                <p className="font-bold text-gray-900">{prod.name}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1 max-w-[200px]">{prod.description || 'No description'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-0.5 bg-purple-50 text-[#714B67] rounded-full text-[10px] font-bold">
                              {prod.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#714B67] font-bold">₹{prod.price.toFixed(2)}</td>
                          <td className="px-6 py-4 text-gray-600 font-bold">
                            {prod.stock} {prod.uom}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => startEditProduct(prod)}
                                className="p-1.5 text-gray-500 hover:text-[#714B67] hover:bg-purple-50 rounded-lg transition-colors"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button 
                                onClick={() => deleteProduct(prod.id)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'categories' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-[#E9ECEF] shadow-sm">
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Item Categories</h3>
                    <p className="text-xs text-gray-400 font-bold">Configure Odoo color palettes for registers</p>
                  </div>
                  <button 
                    onClick={() => { setEditingCategory(null); setCatName(''); setCatColor('#714B67'); setShowCategoryModal(true); }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#714B67] hover:bg-[#57344f] text-white rounded-xl text-xs font-bold transition-all shadow-md"
                  >
                    <Plus size={14} />
                    <span>New Category</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {categories.map((cat) => (
                    <div key={cat.id} className="bg-white border border-[#E9ECEF] rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full border shadow-sm shrink-0" style={{ backgroundColor: cat.color }}></div>
                        <h4 className="font-bold text-sm text-gray-900">{cat.name}</h4>
                      </div>
                      <div className="flex justify-end gap-2 border-t pt-3">
                        <button 
                          onClick={() => startEditCategory(cat)}
                          className="px-2.5 py-1 border rounded-lg text-[10px] font-bold text-gray-500 hover:text-[#714B67] hover:bg-purple-50 flex items-center gap-1 transition-colors"
                        >
                          <Edit3 size={11} />
                          <span>Edit</span>
                        </button>
                        <button 
                          onClick={() => deleteCategory(cat.id)}
                          className="px-2.5 py-1 border rounded-lg text-[10px] font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 size={11} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'tables' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-[#E9ECEF] shadow-sm">
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Floor Plan</h3>
                    <p className="text-xs text-gray-400 font-bold">Configure zone tables and seats</p>
                  </div>
                  <button 
                    onClick={() => { setEditingTable(null); setTableNumber(''); setTableSeats('4'); setTableFloor('Ground Floor'); setShowTableModal(true); }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#714B67] hover:bg-[#57344f] text-white rounded-xl text-xs font-bold transition-all shadow-md"
                  >
                    <Plus size={14} />
                    <span>Add Table</span>
                  </button>
                </div>

                <div className="bg-white border border-[#E9ECEF] rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#f8f9fa] text-[10px] font-bold text-gray-400 uppercase border-b">
                      <tr>
                        <th className="px-6 py-3">Table Identifier</th>
                        <th className="px-6 py-3">Floor Location</th>
                        <th className="px-6 py-3">Seats Count</th>
                        <th className="px-6 py-3">Occupancy Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E9ECEF] text-xs font-semibold text-gray-700">
                      {tables.map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-black text-sm text-gray-900">Table {t.table_number}</span>
                          </td>
                          <td className="px-6 py-4 text-gray-500">{t.floor}</td>
                          <td className="px-6 py-4 text-gray-500 font-bold">{t.seats} seats</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              t.status === 'Active' || t.active_order_id
                                ? 'bg-purple-100 text-[#714B67]' 
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {t.status === 'Active' || t.active_order_id ? 'Occupied' : 'Vacant'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'promotions' && (
              <div className="space-y-8 animate-in fade-in duration-200">
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-[#E9ECEF] shadow-sm">
                    <div>
                      <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Coupons Registry</h3>
                      <p className="text-xs text-gray-400 font-bold">Manage discount coupon codes for checkout linkage</p>
                    </div>
                    <button 
                      onClick={() => { setCoupCode(''); setCoupValue(''); setShowCouponModal(true); }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#714B67] hover:bg-[#57344f] text-white rounded-xl text-xs font-bold transition-all shadow-md"
                    >
                      <Plus size={14} />
                      <span>New Coupon Code</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {coupons.map((c) => (
                      <div key={c.id} className="bg-white border border-[#E9ECEF] rounded-2xl p-5 shadow-sm space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-black text-xs text-gray-900 tracking-wider bg-gray-100 px-2.5 py-1 rounded-md">{c.code}</span>
                          <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[9px] font-bold uppercase">Active</span>
                        </div>
                        <p className="text-xs text-gray-500 font-bold pt-2">
                          Value: {c.discount_type === 'percent' ? `${c.value}% discount` : `₹${c.value.toFixed(2)} off`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-[#E9ECEF] shadow-sm">
                    <div>
                      <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Automated Promotions</h3>
                      <p className="text-xs text-gray-400 font-bold">Configure product-level or order-subtotal auto discounts</p>
                    </div>
                    <button 
                      onClick={() => { setPromoName(''); setPromoValue(''); setPromoMinQty('0'); setPromoMinAmount('0'); setShowPromoModal(true); }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#714B67] hover:bg-[#57344f] text-white rounded-xl text-xs font-bold transition-all shadow-md"
                    >
                      <Plus size={14} />
                      <span>Add Automated Promotion</span>
                    </button>
                  </div>

                  <div className="bg-white border border-[#E9ECEF] rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-[#f8f9fa] text-[10px] font-bold text-gray-400 uppercase border-b">
                        <tr>
                          <th className="px-6 py-3">Promotion Rule</th>
                          <th className="px-6 py-3">Trigger Mode</th>
                          <th className="px-6 py-3">Trigger Condition</th>
                          <th className="px-6 py-3">Discount Benefit</th>
                          <th className="px-6 py-3 text-right">Active Switch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E9ECEF] text-xs font-semibold text-gray-700">
                        {promotions.map((p) => {
                          const targetProductName = products.find(prod => prod.id === p.product_id)?.name || `ID: ${p.product_id}`;
                          return (
                            <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <p className="font-bold text-gray-900">{p.name}</p>
                              </td>
                              <td className="px-6 py-4 uppercase text-[10px] font-bold text-[#714B67]">
                                {p.type === 'product' ? 'Product-Level' : 'Order-Level'}
                              </td>
                              <td className="px-6 py-4 text-gray-500">
                                {p.type === 'product' 
                                  ? `Buy Min Qty: ${p.min_qty} of "${targetProductName}"`
                                  : `Min Subtotal >= ₹${p.min_amount.toFixed(2)}`
                                }
                              </td>
                              <td className="px-6 py-4 font-bold text-green-600">
                                {p.discount_type === 'percent' ? `${p.value}% Off` : `₹${p.value.toFixed(2)} Off`}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => togglePromoStatus(p)}
                                  className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase transition-colors ${
                                    p.active === 1
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                                  }`}
                                >
                                  {p.active === 1 ? 'Enabled' : 'Disabled'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-white p-5 rounded-2xl border border-[#E9ECEF] shadow-sm">
                  <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Payment Terminals Setup</h3>
                  <p className="text-xs text-gray-400 font-bold">Enable register checkout methods and save merchant QR details</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {paymentMethods.map((pm) => (
                    <div key={pm.id} className="bg-white border border-[#E9ECEF] rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-black text-sm text-gray-900">{pm.name}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            pm.enabled === 1 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {pm.enabled === 1 ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold">SYSTEM INTEGRATED GATEWAY</p>
                      </div>

                      {pm.name === 'UPI QR' && (
                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Merchant UPI ID Address</label>
                          <input 
                            type="text" 
                            defaultValue={pm.upi_id || ''}
                            onBlur={(e) => updateUPI(pm, e.target.value)}
                            placeholder="e.g. cafe@ybl"
                            className="w-full border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#714B67] focus:outline-none"
                          />
                        </div>
                      )}

                      <button
                        onClick={() => togglePaymentMethod(pm)}
                        className={`w-full py-2 rounded-xl text-xs font-bold transition-all border ${
                          pm.enabled === 1 
                            ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' 
                            : 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100'
                        }`}
                      >
                        {pm.enabled === 1 ? 'Disable Method' : 'Enable Method'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'employees' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-[#E9ECEF] shadow-sm">
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Baristas & Shift Operators</h3>
                    <p className="text-xs text-gray-400 font-bold">Configure employee roles and credentials</p>
                  </div>
                  <button 
                    onClick={() => { setEmpName(''); setEmpUsername(''); setEmpPassword(''); setShowEmployeeModal(true); }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#714B67] hover:bg-[#57344f] text-white rounded-xl text-xs font-bold transition-all shadow-md"
                  >
                    <Plus size={14} />
                    <span>Hire Barista</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {employees.filter(e => e.archived !== 1).map((emp) => (
                    <div key={emp.id} className="bg-white border border-[#E9ECEF] rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-extrabold text-sm text-gray-900">{emp.name}</h4>
                          <span className="text-[10px] font-black uppercase text-[#714B67] bg-purple-50 px-2 py-0.5 rounded-full">{emp.role}</span>
                        </div>
                        <p className="text-[11px] text-gray-400">Username: <span className="font-bold">{emp.username}</span></p>
                      </div>
                      <button
                        onClick={() => deleteEmployee(emp.id)}
                        className="w-full py-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-all"
                      >
                        Archive Account
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white p-6 rounded-2xl border border-[#E9ECEF] shadow-sm gap-4">
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Shift Sales Analytics</h3>
                    <p className="text-xs text-gray-400 font-bold">Generate report breakdowns and export files</p>
                  </div>
                  
                  <div className="flex gap-2 bg-[#f3f4f5] p-1 rounded-xl border">
                    {['Today', 'This Week', 'This Month'].map(p => (
                      <button
                        key={p}
                        onClick={() => generateCustomReport(p)}
                        className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                          reportPeriod === p ? 'bg-[#714B67] text-white shadow' : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {loadingReport ? (
                  <div className="h-40 bg-white border rounded-2xl flex items-center justify-center">
                    <span className="text-xs font-semibold text-gray-400">Compiling analytics spreadsheet...</span>
                  </div>
                ) : (
                  reportData && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="space-y-6">
                        <div className="bg-[#714B67] text-white rounded-2xl p-6 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-wider opacity-85">Gross Shift Revenue</p>
                          <h4 className="text-2xl font-black mt-1">₹{reportData.revenue.toFixed(2)}</h4>
                        </div>
                        <div className="bg-white border rounded-2xl p-6 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Completed Orders</p>
                          <h4 className="text-2xl font-black mt-1 text-gray-950">{reportData.totalOrders} invoices</h4>
                        </div>
                        <button 
                          onClick={exportReportCSV}
                          className="w-full py-3 bg-[#017E84] hover:bg-[#016469] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow transition-all"
                        >
                          <Download size={14} />
                          <span>Export CSV Spreadsheet</span>
                        </button>
                      </div>

                      <div className="lg:col-span-2 bg-white border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                        <div>
                          <h4 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider mb-4">Top Selling Items in Period</h4>
                          <div className="space-y-4">
                            {reportData.topProducts.map((p, idx) => (
                              <div key={idx} className="flex justify-between items-center border-b pb-2.5 last:border-0">
                                <div>
                                  <p className="font-bold text-xs text-gray-900">{p.name}</p>
                                  <p className="text-[10px] text-gray-400 mt-0.5">{p.quantitySold} units sold</p>
                                </div>
                                <span className="text-xs font-bold text-[#714B67]">₹{p.revenue.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {showProductModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-8 py-5 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h3 className="font-extrabold text-lg text-[#714B67]">
                  {editingProduct ? 'Edit Recipe Record' : 'Add Recipe Catalog'}
                </h3>
                <p className="text-xs text-gray-400 font-bold mt-0.5">
                  {editingProduct ? 'Modify product details and preview changes live' : 'Configure a new menu item with live visual feedback'}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowProductModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors font-bold text-lg animate-fade-in"
              >
                &times;
              </button>
            </div>

            {/* Modal Content - Dual Column */}
            <form onSubmit={handleProductSubmit} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Left Column: Form Fields (7 cols) */}
                <div className="md:col-span-7 space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-gray-400 mb-1">Item Title</label>
                    <input 
                      type="text" 
                      value={prodName} 
                      onChange={(e) => setProdName(e.target.value)} 
                      placeholder="e.g. Iced Vanilla Latte"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-[#714B67] focus:outline-none font-semibold text-sm transition-all"
                      required 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-gray-400 mb-1">Price (₹)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={prodPrice} 
                        onChange={(e) => setProdPrice(e.target.value)} 
                        placeholder="0.00"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-[#714B67] focus:outline-none font-semibold text-sm transition-all"
                        required 
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-400 mb-1">Category</label>
                      <select 
                        value={prodCategory} 
                        onChange={(e) => setProdCategory(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-[#714B67] focus:outline-none font-semibold text-sm transition-all"
                      >
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-400 mb-1">Description</label>
                    <textarea 
                      value={prodDesc} 
                      onChange={(e) => setProdDesc(e.target.value)} 
                      placeholder="Recipe notes, ingredients, allergen warnings..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-[#714B67] focus:outline-none font-semibold text-xs transition-all"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-400 mb-1">Product Image</label>
                    <div className="flex gap-3 items-center">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="product-image-upload"
                      />
                      <label 
                        htmlFor="product-image-upload"
                        className="px-4 py-2.5 border border-[#714B67] text-[#714B67] hover:bg-purple-50 rounded-xl font-bold cursor-pointer text-center flex-grow transition-all whitespace-nowrap block"
                      >
                        Upload Photo
                      </label>
                      <input 
                        type="text" 
                        value={prodImage && prodImage.startsWith('data:image/') ? 'Custom Local Image Uploaded' : prodImage} 
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'Custom Local Image Uploaded') return; // Do nothing
                          setProdImage(val);
                        }} 
                        placeholder="/images/... or upload"
                        className="border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-[#714B67] focus:outline-none font-semibold transition-all w-2/3" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-gray-400 mb-1">UOM</label>
                      <input 
                        type="text" 
                        value={prodUom} 
                        onChange={(e) => setProdUom(e.target.value)} 
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-center font-semibold focus:outline-none focus:ring-1 focus:ring-[#714B67]" 
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-400 mb-1">Tax (%)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={prodTax} 
                        onChange={(e) => setProdTax(e.target.value)} 
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-center font-semibold focus:outline-none focus:ring-1 focus:ring-[#714B67]" 
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-400 mb-1">Initial Stock</label>
                      <input 
                        type="number" 
                        value={prodStock} 
                        onChange={(e) => setProdStock(e.target.value)} 
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-center font-semibold focus:outline-none focus:ring-1 focus:ring-[#714B67]" 
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Premium Live Preview (5 cols) */}
                <div className="md:col-span-5 flex flex-col justify-between bg-gray-50/50 rounded-2xl border border-gray-100 p-6">
                  <div>
                    <span className="text-[10px] font-black text-[#714B67] uppercase tracking-wider bg-purple-50 px-2.5 py-1 rounded-md">
                      Live POS Terminal Card Preview
                    </span>
                    <p className="text-[11px] text-gray-400 mt-1 font-bold">This is how cashiers and customers will see this item.</p>

                    {/* Preview Card Container */}
                    <div className="mt-5 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
                      {/* Product Image Preview */}
                      <div className="h-44 w-full bg-gray-100 relative overflow-hidden flex items-center justify-center">
                        {prodImage ? (
                          <img 
                            src={prodImage} 
                            alt={prodName || 'Preview'} 
                            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                            onError={(e) => {
                              e.target.onerror = null; 
                              e.target.src = '/images/default_coffee.jpg'; // Default Fallback
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-gray-400 p-4 space-y-2">
                            <Coffee size={40} className="text-[#714B67] opacity-60" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">No Image Specified</span>
                          </div>
                        )}
                        
                        {/* Category Badge overlay */}
                        <div 
                          className="absolute top-3 left-3 text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-lg text-white shadow-sm transition-all"
                          style={{ backgroundColor: categories.find(c => c.name === (prodCategory || categories[0]?.name))?.color || '#714B67' }}
                        >
                          {prodCategory || 'Coffee'}
                        </div>

                        {/* Stock status overlay */}
                        <div className={`absolute top-3 right-3 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-lg text-white shadow-sm ${
                          parseInt(prodStock || 0) <= 10 ? 'bg-red-500' : 'bg-emerald-600'
                        }`}>
                          {prodStock || 0} {prodUom || 'pcs'} Left
                        </div>
                      </div>

                      {/* Product Info Preview */}
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <h4 className="font-extrabold text-sm text-gray-900 line-clamp-1 flex-1">
                            {prodName || 'Product Title'}
                          </h4>
                          <span className="font-black text-sm text-[#714B67] ml-2 shrink-0">
                            ₹{parseFloat(prodPrice || 0).toFixed(2)}
                          </span>
                        </div>

                        <p className="text-[10px] text-gray-500 font-bold line-clamp-2 min-h-[30px]">
                          {prodDesc || 'Product description. Enter descriptions to help staff distinguish item recipes.'}
                        </p>

                        <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                          <span>UOM: <span className="text-gray-700">{prodUom || 'pcs'}</span></span>
                          <span>Tax Rate: <span className="text-gray-700">{prodTax || 8.0}%</span></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit / Cancel Buttons */}
                  <div className="flex gap-3 pt-6 border-t border-gray-100 mt-6 text-xs">
                    <button 
                      type="button" 
                      onClick={() => setShowProductModal(false)}
                      className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-100 rounded-xl font-bold text-gray-500 active:scale-95 transition-all text-center"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 py-2.5 bg-[#714B67] hover:bg-[#57344f] text-white rounded-xl font-bold shadow-md hover:shadow-lg active:scale-95 transition-all text-center"
                    >
                      {editingProduct ? 'Save Changes' : 'Create Product'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <form onSubmit={handleCategorySubmit} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 space-y-4">
            <h3 className="font-extrabold text-lg text-[#714B67]">
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-400 mb-1">Category Title</label>
                <input 
                  type="text" 
                  value={catName} 
                  onChange={(e) => setCatName(e.target.value)} 
                  className="w-full border rounded-xl px-3 py-2 font-semibold text-sm"
                  required 
                />
              </div>
              <div>
                <label className="block font-bold text-gray-400 mb-1">Theme Color</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="color" 
                    value={catColor} 
                    onChange={(e) => setCatColor(e.target.value)} 
                    className="w-10 h-10 border rounded-lg" 
                  />
                  <span className="font-bold text-gray-600">{catColor}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 text-xs">
              <button 
                type="button" 
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 py-2 border rounded-xl text-gray-500"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="flex-1 py-2 bg-[#714B67] text-white rounded-xl font-bold"
              >
                Save Category
              </button>
            </div>
          </form>
        </div>
      )}

      {showTableModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <form onSubmit={handleTableSubmit} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 space-y-4">
            <h3 className="font-extrabold text-lg text-[#714B67]">Add Floor Table</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-400 mb-1">Table Number/Identifier</label>
                <input 
                  type="text" 
                  placeholder="e.g. 15 or T3"
                  value={tableNumber} 
                  onChange={(e) => setTableNumber(e.target.value)} 
                  className="w-full border rounded-xl px-3 py-2 font-semibold text-sm"
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-400 mb-1">Seats Count</label>
                  <input 
                    type="number" 
                    value={tableSeats} 
                    onChange={(e) => setTableSeats(e.target.value)} 
                    className="w-full border rounded-xl px-3 py-2 font-semibold text-sm text-center"
                    required 
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-400 mb-1">Floor Zone</label>
                  <select 
                    value={tableFloor} 
                    onChange={(e) => setTableFloor(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 font-semibold text-sm focus:outline-none"
                  >
                    <option value="Ground Floor">Ground Floor</option>
                    <option value="First Floor">First Floor</option>
                    <option value="Terrace">Terrace</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 text-xs">
              <button 
                type="button" 
                onClick={() => setShowTableModal(false)}
                className="flex-1 py-2 border rounded-xl text-gray-500"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="flex-1 py-2 bg-[#714B67] text-white rounded-xl font-bold"
              >
                Save Table
              </button>
            </div>
          </form>
        </div>
      )}

      {showCouponModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <form onSubmit={handleCouponSubmit} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 space-y-4">
            <h3 className="font-extrabold text-lg text-[#714B67]">Add Coupon Code</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-400 mb-1">Coupon Code</label>
                <input 
                  type="text" 
                  placeholder="e.g. CAFE20"
                  value={coupCode} 
                  onChange={(e) => setCoupCode(e.target.value)} 
                  className="w-full border rounded-xl px-3 py-2 font-semibold text-sm"
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-400 mb-1">Discount Type</label>
                  <select 
                    value={coupType} 
                    onChange={(e) => setCoupType(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 font-semibold text-sm"
                  >
                    <option value="percent">Percent (%)</option>
                    <option value="fixed">Fixed (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-400 mb-1">Discount Value</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="e.g. 10"
                    value={coupValue} 
                    onChange={(e) => setCoupValue(e.target.value)} 
                    className="w-full border rounded-xl px-3 py-2 font-semibold text-sm text-center"
                    required 
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 text-xs">
              <button 
                type="button" 
                onClick={() => setShowCouponModal(false)}
                className="flex-1 py-2 border rounded-xl text-gray-500"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="flex-1 py-2 bg-[#714B67] text-white rounded-xl font-bold"
              >
                Save Coupon
              </button>
            </div>
          </form>
        </div>
      )}

      {showPromoModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <form onSubmit={handlePromoSubmit} className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 space-y-4">
            <h3 className="font-extrabold text-lg text-[#714B67]">Create Promotion Rule</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-400 mb-1">Promotion Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Weekend Matcha Madness"
                  value={promoName} 
                  onChange={(e) => setPromoName(e.target.value)} 
                  className="w-full border rounded-xl px-3 py-2 font-semibold text-sm"
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-400 mb-1">Promotion Mode</label>
                  <select 
                    value={promoType} 
                    onChange={(e) => setPromoType(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 font-semibold text-sm"
                  >
                    <option value="product">Product-level Trigger</option>
                    <option value="order">Order subtotal Trigger</option>
                  </select>
                </div>

                {promoType === 'product' ? (
                  <div>
                    <label className="block font-bold text-gray-400 mb-1">Trigger Product</label>
                    <select 
                      value={promoProductId} 
                      onChange={(e) => setPromoProductId(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 font-semibold text-sm"
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block font-bold text-gray-400 mb-1">Min Subtotal (₹)</label>
                    <input 
                      type="number" 
                      step="0.10"
                      value={promoMinAmount} 
                      onChange={(e) => setPromoMinAmount(e.target.value)} 
                      className="w-full border rounded-xl px-3 py-2 font-semibold text-sm text-center"
                    />
                  </div>
                )}
              </div>

              {promoType === 'product' && (
                <div>
                  <label className="block font-bold text-gray-400 mb-1">Minimum Quantity Required</label>
                  <input 
                    type="number" 
                    value={promoMinQty} 
                    onChange={(e) => setPromoMinQty(e.target.value)} 
                    className="w-full border rounded-xl px-3 py-2 font-semibold text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-400 mb-1">Benefit Discount Type</label>
                  <select 
                    value={promoDiscType} 
                    onChange={(e) => setPromoDiscType(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 font-semibold text-sm"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed Cash Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-400 mb-1">Benefit Value</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="e.g. 20"
                    value={promoValue} 
                    onChange={(e) => setPromoValue(e.target.value)} 
                    className="w-full border rounded-xl px-3 py-2 font-semibold text-sm text-center"
                    required 
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 text-xs">
              <button 
                type="button" 
                onClick={() => setShowPromoModal(false)}
                className="flex-1 py-2 border rounded-xl text-gray-500"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="flex-1 py-2 bg-[#714B67] text-white rounded-xl font-bold"
              >
                Activate Rule
              </button>
            </div>
          </form>
        </div>
      )}

      {showEmployeeModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <form onSubmit={handleEmployeeSubmit} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 space-y-4">
            <h3 className="font-extrabold text-lg text-[#714B67]">Hire Barista Staff</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-400 mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={empName} 
                  onChange={(e) => setEmpName(e.target.value)} 
                  className="w-full border rounded-xl px-3 py-2 font-semibold text-sm"
                  required 
                />
              </div>
              <div>
                <label className="block font-bold text-gray-400 mb-1">Username Identifier</label>
                <input 
                  type="text" 
                  placeholder="e.g. sarah"
                  value={empUsername} 
                  onChange={(e) => setEmpUsername(e.target.value)} 
                  className="w-full border rounded-xl px-3 py-2 font-semibold text-sm"
                  required 
                />
              </div>
              <div>
                <label className="block font-bold text-gray-400 mb-1">Default Password</label>
                <input 
                  type="password" 
                  value={empPassword} 
                  onChange={(e) => setEmpPassword(e.target.value)} 
                  className="w-full border rounded-xl px-3 py-2 font-semibold text-sm"
                  required 
                />
              </div>
              <div>
                <label className="block font-bold text-gray-400 mb-1">Assigned Role</label>
                <select 
                  value={empRole} 
                  onChange={(e) => setEmpRole(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 font-semibold text-sm"
                >
                  <option value="cashier">Cashier Staff</option>
                  <option value="manager">Lead Store Manager</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2 text-xs">
              <button 
                type="button" 
                onClick={() => setShowEmployeeModal(false)}
                className="flex-1 py-2 border rounded-xl text-gray-500"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="flex-1 py-2 bg-[#714B67] text-white rounded-xl font-bold"
              >
                Add Member
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
