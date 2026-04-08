import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './i18n';
import './index.css';
import AppRoutes from './routes/AppRoutes.jsx';
import { AuthProvider } from './components/AuthContext.jsx';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev';
const APP_VERSION_KEY = 'soulvest_app_version';
const APP_RELOAD_KEY = 'soulvest_app_reload_version';
const SW_CONTROLLER_RELOAD_KEY = 'soulvest_sw_controller_reload_version';
const PWA_UPDATE_INTERVAL = 60 * 1000;

function replaceWithVersionedUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('v', APP_VERSION);
  window.location.replace(url.toString());
}

async function resetPwaCaches() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ('caches' in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
  }
}

async function enforceLatestDeployment() {
  const previousVersion = localStorage.getItem(APP_VERSION_KEY);
  const reloadVersion = sessionStorage.getItem(APP_RELOAD_KEY);

  if (previousVersion === APP_VERSION) {
    if (reloadVersion === APP_VERSION) {
      sessionStorage.removeItem(APP_RELOAD_KEY);
    }
    return false;
  }

  localStorage.setItem(APP_VERSION_KEY, APP_VERSION);

  if (reloadVersion === APP_VERSION) {
    sessionStorage.removeItem(APP_RELOAD_KEY);
    return false;
  }

  const hasExistingController = 'serviceWorker' in navigator && navigator.serviceWorker.controller;
  if (!previousVersion && !hasExistingController) {
    return false;
  }

  sessionStorage.setItem(APP_RELOAD_KEY, APP_VERSION);
  await resetPwaCaches();
  replaceWithVersionedUrl();
  return true;
}

function setupServiceWorker() {
  let updateSW;

  if ('serviceWorker' in navigator) {
    const previousControllerReload = sessionStorage.getItem(SW_CONTROLLER_RELOAD_KEY);
    let controllerRefreshHandled = previousControllerReload === APP_VERSION;

    if (controllerRefreshHandled) {
      sessionStorage.removeItem(SW_CONTROLLER_RELOAD_KEY);
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (controllerRefreshHandled) {
        return;
      }

      controllerRefreshHandled = true;
      sessionStorage.setItem(SW_CONTROLLER_RELOAD_KEY, APP_VERSION);
      replaceWithVersionedUrl();
    });
  }

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW?.(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) {
        return;
      }

      registration.update();
      window.setInterval(() => {
        registration.update();
      }, PWA_UPDATE_INTERVAL);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update();
        }
      });
    },
  });
}

function renderApp() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

async function startApp() {
  const redirected = await enforceLatestDeployment();
  if (redirected) {
    return;
  }

  setupServiceWorker();
  renderApp();
}

void startApp();
