// In production, VITE_API_URL points to the deployed backend.
// In development, Vite proxy handles /api → localhost:3001.
const BASE_URL = import.meta.env.VITE_API_URL || '';

export const apiFetch = async (url, options = {}) => {
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

  return fetch(`${BASE_URL}${url}`, { ...options, headers });
};
