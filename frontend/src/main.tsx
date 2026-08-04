import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import axios from 'axios'
// Setup global Axios interceptor for Role-Based Access Control
axios.interceptors.request.use((config) => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            if (user?.user_id) {
                config.headers = (config.headers || {}) as any;
                if (typeof config.headers.set === 'function') {
                    config.headers.set('X-User-Id', user.user_id.toString());
                    config.headers.set('X-User-Role', user.role || '');
                } else {
                    config.headers['X-User-Id'] = user.user_id.toString();
                    config.headers['X-User-Role'] = user.role || '';
                }
            }
        } catch (e) {
            // ignore JSON parse error
        }
    }
    return config;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
