import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AppRoutes from './routes/AppRoutes.jsx';
import { AuthProvider } from './components/AuthContext.jsx';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
