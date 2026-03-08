import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider, useIsAuthenticated, useMsal } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig, loginRequest } from './auth/msalConfig';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import DeviceDetail from './pages/DeviceDetail';
import DeviceForm from './pages/DeviceForm';
import SellForm from './pages/SellForm';
import RentalForm from './pages/RentalForm';
import ReturnForm from './pages/ReturnForm';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

const msalInstance = new PublicClientApplication(msalConfig);

function LoginPage() {
  const { instance } = useMsal();

  const handleLogin = async () => {
    await instance.loginPopup(loginRequest);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-sm w-full text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">携帯レンタル管理システム</h1>
          <p className="text-sm text-gray-500 mt-2">フォーカス株式会社</p>
        </div>
        <button
          onClick={handleLogin}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          Microsoftアカウントでログイン
        </button>
      </div>
    </div>
  );
}

function AppRoutes() {
  const isAuthenticated = useIsAuthenticated();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/devices/new" element={<DeviceForm />} />
          <Route path="/devices/:id" element={<DeviceDetail />} />
          <Route path="/devices/:id/edit" element={<DeviceForm />} />
          <Route path="/devices/:id/sell" element={<SellForm />} />
          <Route path="/contracts" element={<Navigate to="/devices" replace />} />
          <Route path="/contracts/new" element={<RentalForm />} />
          <Route path="/contracts/:id/return" element={<ReturnForm />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AppRoutes />
    </MsalProvider>
  );
}
