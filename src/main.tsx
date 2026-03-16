import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';

const queryClient = new QueryClient();
const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 5,
  defaultRadius: 'md',
  fontFamily: 'var(--font-ui)',
  fontFamilyMonospace: 'var(--font-mono)',
  headings: {
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
  },
  colors: {
    brand: ['#eef5ff', '#d8e8ff', '#b9d6ff', '#8dbaff', '#5f9cff', '#1677ff', '#0d67df', '#0952b2', '#083d84', '#072a57'],
    profit: ['#e7fbf3', '#caf7e7', '#9debcf', '#68d7af', '#33bc8a', '#0f9b68', '#087d54', '#056143', '#054b35', '#033223'],
    danger: ['#fff1f1', '#ffe0e0', '#ffc5c5', '#ff9f9f', '#ff7676', '#ef4444', '#d73737', '#b12b2b', '#8f2626', '#651818'],
  },
  components: {
    AppShell: {
      defaultProps: {
        padding: 'lg',
      },
    },
    Paper: {
      defaultProps: {
        radius: 'lg',
      },
    },
    Card: {
      defaultProps: {
        radius: 'lg',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'xl',
        variant: 'light',
      },
    },
    Button: {
      defaultProps: {
        radius: 'xl',
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: 'xl',
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    Select: {
      defaultProps: {
        radius: 'md',
      },
    },
    Drawer: {
      defaultProps: {
        radius: 'lg',
      },
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <MantineProvider
          defaultColorScheme="light"
          theme={theme}
        >
          <Notifications position="top-right" />
          <App />
        </MantineProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
