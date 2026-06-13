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
  
  return fetch(url, { ...options, headers });
};
