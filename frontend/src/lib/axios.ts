import axios from 'axios';

const api = axios.create({
  baseURL: '/', // Vite proxy handles the host
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle global errors here
    if (error.response && error.response.status === 401) {
      // Handle unauthorized access if needed
      // window.location.href = '/user/login'; // Example
    }
    return Promise.reject(error);
  }
);

export default api;


