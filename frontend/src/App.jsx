import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import CashierTerminal from './pages/CashierTerminal.jsx';
import SelfService from './pages/SelfService.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import KDS from './pages/KDS.jsx';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            user ? (
              user.role === 'manager' ? (
                <Navigate to="/dashboard" replace />
              ) : user.role === 'cashier' ? (
                <Navigate to="/cashier" replace />
              ) : user.role === 'cook' ? (
                <Navigate to="/kds" replace />
              ) : (
                <Navigate to="/self-service" replace />
              )
            ) : (
              <Login onLogin={handleLogin} />
            )
          } 
        />
        
        <Route 
          path="/cashier" 
          element={
            user && (user.role === 'cashier' || user.role === 'manager') ? (
              <CashierTerminal user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/dashboard" 
          element={
            user && user.role === 'manager' ? (
              <AdminDashboard user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/self-service" 
          element={<SelfService />} 
        />

        <Route 
          path="/kds" 
          element={
            user && (user.role === 'cook' || user.role === 'manager') ? (
              <KDS onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="*" 
          element={<Navigate to="/login" replace />} 
        />
      </Routes>
    </Router>
  );
}

export default App;
