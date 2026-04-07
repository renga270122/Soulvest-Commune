import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2456A6', // Deep blue for buttons
    },
    secondary: {
      main: '#E09C3D', // Warm orange accent
    },
    background: {
      default: '#F8F3E7', // Warm beige background
      paper: '#FFF9ED', // Slightly off-white for cards
    },
    text: {
      primary: '#3B2E1A', // Deep brown for headings
      secondary: '#5E4B2B', // Darker brown for better mobile contrast
    },
    success: {
      main: '#4B9B3E', // Green for status
    },
    warning: {
      main: '#E09C3D', // Orange for status
    },
    error: {
      main: '#C94A3A', // Red for errors
    },
    divider: '#E0C9A6', // Light brown divider
  },
  typography: {
    fontFamily: 'Nunito, Arial, sans-serif',
    h1: { fontWeight: 700, letterSpacing: 0.5 },
    h2: { fontWeight: 700, letterSpacing: 0.3 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    body1: { fontWeight: 600, lineHeight: 1.55 },
    body2: { fontWeight: 600, lineHeight: 1.5 },
    subtitle1: { fontWeight: 700 },
    subtitle2: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px #e0c9a6',
          fontWeight: 700,
          letterSpacing: 0.15,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        label: {
          fontWeight: 700,
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        input: {
          color: '#2F2210',
          fontWeight: 600,
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          color: '#4D3B20',
          fontWeight: 700,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          background: '#FFF9ED',
          borderRadius: 16,
          boxShadow: '0 2px 8px #e0c9a6',
        },
      },
    },
  },
});

export default theme;
