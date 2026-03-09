import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';

const navItems = [
  { path: '/', label: 'ダッシュボード', icon: '🏠' },
  { path: '/devices', label: '端末管理', icon: '📱' },
  { path: '/contracts', label: '契約管理', icon: '📋' },
  { path: '/reports', label: '料金・利益', icon: '💰' },
  { path: '/settings', label: '設定', icon: '⚙️' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { instance, accounts } = useMsal();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const user = accounts[0];

  const handleLogout = () => {
    instance.logoutPopup();
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* サイドバー */}
      <aside
        className={`${sidebarOpen ? 'w-56' : 'w-14'} bg-slate-900 text-white flex flex-col transition-all duration-200`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
          {sidebarOpen && (
            <span className="text-sm font-bold leading-tight">携帯レンタル<br />管理システム</span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white p-1"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const active = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors
                  ${active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                <span className="text-lg">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* 外部リンク */}
        <div className="border-t border-slate-700 py-3">
          <a
            href="https://license-mgmt-focus.azurewebsites.net/dashboard"
            target="contract-mgmt-system"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-slate-800 hover:text-yellow-300 transition-colors"
          >
            <span className="text-lg">🔑</span>
            {sidebarOpen && <span className="leading-tight">契約管理<br />システム</span>}
          </a>
        </div>

        <div className="border-t border-slate-700 p-4">
          {sidebarOpen && (
            <p className="text-xs text-gray-400 mb-2 truncate">
              {user?.name || user?.username}
            </p>
          )}
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-white"
          >
            {sidebarOpen ? 'ログアウト' : '↩'}
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-hidden">
        <div className="p-6 h-full overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
