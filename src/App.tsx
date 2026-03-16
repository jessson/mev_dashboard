import { Center, Loader, Stack, Text } from '@mantine/core';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardProvider } from './context/DashboardContext';
import DashboardLayout from './layouts/DashboardLayout';
import ChainsPage from './pages/ChainsPage';
import LoginRoute from './pages/LoginRoute';
import NodesPage from './pages/NodesPage';
import OverviewPage from './pages/OverviewPage';
import TradesPage from './pages/TradesPage';
import WarningsPage from './pages/WarningsPage';
import WelcomeRoute from './pages/WelcomeRoute';

const FullPageLoader = () => {
  return (
    <Center h="100vh" bg="linear-gradient(145deg, #eaf2ff 0%, #f5f7ff 40%, #f3f8ff 100%)">
      <Stack align="center" gap="xs">
        <Loader color="blue" type="dots" />
        <Text c="dimmed">正在初始化应用...</Text>
      </Stack>
    </Center>
  );
};

const AuthGate = () => {
  const { initialized, isAuthenticated } = useAuth();

  if (!initialized) {
    return <FullPageLoader />;
  }

  return <Navigate to={isAuthenticated ? '/app/overview' : '/welcome'} replace />;
};

const PublicRoute = () => {
  const { initialized, isAuthenticated } = useAuth();

  if (!initialized) {
    return <FullPageLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/app/overview" replace />;
  }

  return <Outlet />;
};

const ProtectedRoute = () => {
  const { initialized, isAuthenticated } = useAuth();

  if (!initialized) {
    return <FullPageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <DashboardProvider>
      <DashboardLayout />
    </DashboardProvider>
  );
};

const AdminRoute = () => {
  const { user } = useAuth();

  if (user?.type !== 'admin') {
    return <Navigate to="/app/overview" replace />;
  }

  return <Outlet />;
};

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<AuthGate />} />

        <Route element={<PublicRoute />}>
          <Route path="/welcome" element={<WelcomeRoute />} />
          <Route path="/login" element={<LoginRoute />} />
        </Route>

        <Route path="/app" element={<ProtectedRoute />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="trades" element={<TradesPage />} />
          <Route path="nodes" element={<NodesPage />} />
          <Route element={<AdminRoute />}>
            <Route path="warnings" element={<WarningsPage />} />
            <Route path="chains" element={<ChainsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
