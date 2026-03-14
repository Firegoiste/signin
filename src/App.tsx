import { useState, useEffect, lazy, Suspense } from 'react'; // 导入 React 钩子

// 使用 React.lazy 进行代码分割，避免手机端加载大屏的沉重 3D 库
const BigScreen = lazy(() => import('./components/BigScreen'));
const MobileCheckIn = lazy(() => import('./components/MobileCheckIn'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));

export default function App() {
  // 定义当前视图状态，默认为大屏
  const [view, setView] = useState<'bigscreen' | 'checkin' | 'admin'>('bigscreen');

  useEffect(() => {
    // 根据 URL 路径切换视图
    const path = window.location.pathname;
    if (path === '/checkin') {
      setView('checkin'); // 手机签到页面
    } else if (path === '/admin') {
      setView('admin'); // 管理后台页面
    } else {
      setView('bigscreen'); // 默认大屏页面
    }
  }, []); // 仅在组件挂载时运行一次

  return (
    <div className="min-h-screen">
      {/* 使用 Suspense 包裹懒加载组件，提供简单的加载状态 */}
      <Suspense fallback={<div className="min-h-screen bg-[#1a0505] flex items-center justify-center text-[#fff0ad]">加载中...</div>}>
        {/* 根据状态渲染对应的组件 */}
        {view === 'bigscreen' && <BigScreen />}
        {view === 'checkin' && <MobileCheckIn />}
        {view === 'admin' && <AdminDashboard />}
      </Suspense>
    </div>
  );
}
