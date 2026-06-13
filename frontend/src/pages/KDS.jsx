import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  Play, 
  Check, 
  Clock, 
  Coffee, 
  Utensils, 
  Layers, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Filter 
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

function KDS() {
  const [orders, setOrders] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [crossedItems, setCrossedItems] = useState({}); // orderId-itemName key

  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain1.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.15);

      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1200, audioCtx.currentTime); 
        gain2.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.2);
      }, 120);
    } catch (e) {
      console.warn("Audio Context failed to initialize: ", e);
    }
  };

  const fetchKDSOrders = async () => {
    try {
      const res = await apiFetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        const kitchenOrders = data.filter(order => 
          ['To Cook', 'Preparing', 'Completed'].includes(order.status)
        );
        setOrders(kitchenOrders);
      }
    } catch (err) {
      console.error('Error fetching KDS orders:', err);
    }
  };

  useEffect(() => {
    fetchKDSOrders();

    const socket = io();

    socket.on('kitchen_order', (newOrder) => {
      setOrders(prev => {
        if (prev.some(o => o.id === newOrder.id)) return prev;
        return [newOrder, ...prev];
      });
      playAlertSound();
    });

    socket.on('kitchen_stage_updated', ({ id, stage }) => {
      setOrders(prev => 
        prev.map(o => o.id === id ? { ...o, status: stage } : o)
      );
    });

    socket.on('order_updated', ({ id, status }) => {
      fetchKDSOrders();
    });

    return () => {
      socket.disconnect();
    };
  }, [soundEnabled]);

  const updateStage = async (orderId, newStage) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/kitchen-stage`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stage: newStage })
      });
      if (res.ok) {
        setOrders(prev => 
          prev.map(o => o.id === orderId ? { ...o, status: newStage } : o)
        );
      }
    } catch (err) {
      console.error('Error updating kitchen stage:', err);
    }
  };

  const toggleItemCrossed = (orderId, itemName) => {
    const key = `${orderId}-${itemName}`;
    setCrossedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getFilteredItems = (items) => {
    if (activeFilter === 'All') return items;
    return items.filter(item => {
      const name = item.name.toLowerCase();
      if (activeFilter === 'Coffee') {
        return name.includes('espresso') || name.includes('flat') || name.includes('cappuccino') || name.includes('cold brew') || name.includes('coffee');
      }
      if (activeFilter === 'Tea') {
        return name.includes('matcha') || name.includes('grey') || name.includes('tea') || name.includes('latte');
      }
      if (activeFilter === 'Pastries') {
        return name.includes('croissant') || name.includes('chocolat') || name.includes('donut') || name.includes('pastry');
      }
      if (activeFilter === 'Lunch') {
        return name.includes('toast') || name.includes('avocado') || name.includes('lunch') || name.includes('sandwich');
      }
      return true;
    });
  };

  const getTicketDuration = (createdAt) => {
    const start = new Date(createdAt).getTime();
    const now = Date.now();
    const diff = Math.floor((now - start) / 1000); // in seconds
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return {
      text: `${mins}m ${secs}s`,
      seconds: diff
    };
  };

  const [, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f1115] text-white flex flex-col font-sans">
      <header className="h-16 bg-[#161b22] border-b border-[#21262d] px-6 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded bg-[#714B67] flex items-center justify-center text-white">
            <Utensils size={18} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider text-white">KITCHEN DISPLAY SYSTEM</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Odoo Cafe POS • Real-time</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold border ${
              soundEnabled 
                ? 'bg-purple-950/30 border-purple-500/30 text-purple-400 hover:bg-purple-950/50' 
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span className="hidden sm:inline">{soundEnabled ? "Alerts On" : "Muted"}</span>
          </button>

          <div className="flex bg-[#0f1115] p-1 rounded-xl border border-[#21262d]">
            {['All', 'Coffee', 'Tea', 'Pastries', 'Lunch'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFilter === cat
                    ? 'bg-[#714B67] text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto p-6 flex gap-6 align-stretch">
        <div className="flex-1 min-w-[340px] bg-[#161b22]/40 rounded-2xl border border-[#21262d] flex flex-col p-4">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#21262d]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-gray-200">To Cook</h2>
            </div>
            <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-xs font-bold">
              {orders.filter(o => o.status === 'To Cook').length} Tickets
            </span>
          </div>

          <div className="flex-grow overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            {orders.filter(o => o.status === 'To Cook').map((order) => {
              const duration = getTicketDuration(order.created_at);
              const isDelayed = duration.seconds > 180;
              const filteredItems = getFilteredItems(order.items);

              if (filteredItems.length === 0) return null;

              return (
                <div 
                  key={order.id}
                  className={`bg-[#161b22] border rounded-xl overflow-hidden shadow-md flex flex-col transition-all duration-200 ${
                    isDelayed ? 'border-red-500/60 shadow-red-950/20' : 'border-[#30363d]'
                  }`}
                >
                  <div className={`p-3 flex justify-between items-center border-b ${
                    isDelayed ? 'bg-red-950/20 border-red-500/20' : 'bg-[#21262d] border-[#30363d]'
                  }`}>
                    <div>
                      <span className="font-black text-sm text-white">#POS-{order.id}</span>
                      <span className="ml-2 text-[10px] bg-white/10 px-2 py-0.5 rounded font-bold text-gray-300">
                        {order.table_id ? `Table ${order.table_id}` : 'Takeaway'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <Clock size={12} className={isDelayed ? 'text-red-400' : 'text-gray-400'} />
                      <span className={isDelayed ? 'text-red-400 font-bold' : 'text-gray-300'}>{duration.text}</span>
                    </div>
                  </div>

                  <div className="p-4 flex-grow space-y-2">
                    {filteredItems.map((item, idx) => {
                      const isCrossed = crossedItems[`${order.id}-${item.name}`];
                      return (
                        <div 
                          key={idx}
                          onClick={() => toggleItemCrossed(order.id, item.name)}
                          className="flex justify-between items-center py-1.5 border-b border-[#21262d] last:border-0 cursor-pointer select-none group"
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs ${
                              isCrossed ? 'bg-zinc-800 text-zinc-500 line-through' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {item.quantity}x
                            </span>
                            <span className={`text-sm font-semibold transition-all ${
                              isCrossed ? 'text-zinc-600 line-through' : 'text-gray-200 group-hover:text-white'
                            }`}>
                              {item.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {order.note && (
                      <div className="mt-3 p-2 bg-yellow-950/20 border border-yellow-800/20 rounded text-xs text-yellow-300/80 italic">
                        Note: {order.note}
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => updateStage(order.id, 'Preparing')}
                    className="w-full py-3 bg-[#714B67] hover:bg-[#57344f] text-white font-bold text-xs flex items-center justify-center gap-2 border-t border-[#30363d] transition-all"
                  >
                    <Play size={12} fill="white" />
                    <span>Start Preparing</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-w-[340px] bg-[#161b22]/40 rounded-2xl border border-[#21262d] flex flex-col p-4">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#21262d]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-gray-200">Preparing</h2>
            </div>
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-xs font-bold">
              {orders.filter(o => o.status === 'Preparing').length} Tickets
            </span>
          </div>

          <div className="flex-grow overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            {orders.filter(o => o.status === 'Preparing').map((order) => {
              const duration = getTicketDuration(order.created_at);
              const filteredItems = getFilteredItems(order.items);

              if (filteredItems.length === 0) return null;

              return (
                <div 
                  key={order.id}
                  className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-md flex flex-col"
                >
                  <div className="p-3 bg-[#21262d] border-b border-[#30363d] flex justify-between items-center">
                    <div>
                      <span className="font-black text-sm text-white">#POS-{order.id}</span>
                      <span className="ml-2 text-[10px] bg-white/10 px-2 py-0.5 rounded font-bold text-gray-300">
                        {order.table_id ? `Table ${order.table_id}` : 'Takeaway'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
                      <Clock size={12} className="text-amber-400" />
                      <span>{duration.text}</span>
                    </div>
                  </div>

                  <div className="p-4 flex-grow space-y-2">
                    {filteredItems.map((item, idx) => {
                      const isCrossed = crossedItems[`${order.id}-${item.name}`];
                      return (
                        <div 
                          key={idx}
                          onClick={() => toggleItemCrossed(order.id, item.name)}
                          className="flex justify-between items-center py-1.5 border-b border-[#21262d] last:border-0 cursor-pointer select-none group"
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs ${
                              isCrossed ? 'bg-zinc-800 text-zinc-500 line-through' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {item.quantity}x
                            </span>
                            <span className={`text-sm font-semibold transition-all ${
                              isCrossed ? 'text-zinc-600 line-through' : 'text-gray-200 group-hover:text-white'
                            }`}>
                              {item.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {order.note && (
                      <div className="mt-3 p-2 bg-yellow-950/20 border border-yellow-800/20 rounded text-xs text-yellow-300/80 italic">
                        Note: {order.note}
                      </div>
                    )}
                  </div>

                  <div className="flex border-t border-[#30363d]">
                    <button 
                      onClick={() => updateStage(order.id, 'To Cook')}
                      className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <RotateCcw size={12} />
                      <span>Recall</span>
                    </button>
                    <button 
                      onClick={() => updateStage(order.id, 'Completed')}
                      className="flex-1 py-3 bg-green-700 hover:bg-green-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Check size={12} />
                      <span>Ready / Serve</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-w-[340px] bg-[#161b22]/40 rounded-2xl border border-[#21262d] flex flex-col p-4">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#21262d]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-gray-200">Completed</h2>
            </div>
            <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded text-xs font-bold">
              {orders.filter(o => o.status === 'Completed').length} Tickets
            </span>
          </div>

          <div className="flex-grow overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            {orders.filter(o => o.status === 'Completed').map((order) => {
              const filteredItems = getFilteredItems(order.items);
              if (filteredItems.length === 0) return null;

              return (
                <div 
                  key={order.id}
                  className="bg-[#161b22]/60 border border-[#30363d]/50 rounded-xl overflow-hidden opacity-60 hover:opacity-100 transition-opacity flex flex-col"
                >
                  <div className="p-3 bg-[#21262d]/50 border-b border-[#30363d]/50 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-sm text-gray-300">#POS-{order.id}</span>
                      <span className="ml-2 text-[10px] bg-white/5 px-2 py-0.5 rounded font-bold text-gray-400">
                        {order.table_id ? `Table ${order.table_id}` : 'Takeaway'}
                      </span>
                    </div>
                    <span className="text-[10px] text-green-400 font-bold uppercase">Ready</span>
                  </div>

                  <div className="p-4 flex-grow space-y-2">
                    {filteredItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 text-zinc-500 line-through text-sm">
                        <span>{item.quantity}x {item.name}</span>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => updateStage(order.id, 'Preparing')}
                    className="w-full py-2 bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 font-bold text-xs flex items-center justify-center gap-1.5 border-t border-[#30363d]/50 transition-all"
                  >
                    <RotateCcw size={11} />
                    <span>Recall to Preparing</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default KDS;
