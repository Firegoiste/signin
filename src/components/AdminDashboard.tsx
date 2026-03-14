import { useState, useEffect, FormEvent } from 'react'; // 导入 React 钩子
import { io } from 'socket.io-client'; // 导入 Socket.io 客户端
import * as XLSX from 'xlsx'; // 导入 Excel 处理库
import { Users, Download, Lock, LogOut, Search } from 'lucide-react'; // 导入图标

// 定义签到数据接口
interface Checkin {
  id: number;
  name: string;
  company: string;
  position: string;
  phone: string;
  province: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false); // 是否已登录认证
  const [password, setPassword] = useState(''); // 登录密码状态
  const [checkins, setCheckins] = useState<Checkin[]>([]); // 签到列表数据
  const [searchTerm, setSearchTerm] = useState(''); // 搜索关键词状态

  useEffect(() => {
    if (isAuthenticated) {
      fetchCheckins(); // 获取初始签到数据
      // 初始化 Socket 连接以接收实时更新
      const socket = io({
        path: "/socket.io/",
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        transports: ['websocket', 'polling']
      });
      
      socket.on('connect', () => {
        console.log('管理员已连接到 Socket');
      });

      socket.on('connect_error', (err) => {
        console.warn('管理员 Socket 连接错误:', err.message);
      });

      // 监听新签到事件并更新列表
      socket.on('new-checkin', (data: Checkin) => {
        setCheckins(prev => [data, ...prev]);
      });
      return () => {
        socket.disconnect(); // 组件卸载时断开连接
      };
    }
  }, [isAuthenticated]);

  // 从 API 获取签到列表
  const fetchCheckins = async () => {
    const res = await fetch('/api/checkins');
    const data = await res.json();
    setCheckins(data);
  };

  // 处理登录逻辑
  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (password === 'admin888') { // 简单密码验证
      setIsAuthenticated(true);
    } else {
      alert('密码错误');
    }
  };

  // 导出数据到 Excel
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      checkins.map(c => ({
        '姓名': c.name,
        '单位': c.company,
        '职务': c.position,
        '省份': c.province,
        '手机号': c.phone,
        '签到时间': new Date(c.created_at).toLocaleString()
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "签到列表");
    XLSX.writeFile(workbook, "会议签到数据.xlsx");
  };

  // 根据搜索词过滤签到列表
  const filteredCheckins = checkins.filter(c => 
    c.name.includes(searchTerm) || 
    c.company.includes(searchTerm) || 
    c.phone.includes(searchTerm) ||
    (c.province && c.province.includes(searchTerm))
  );

  // 登录界面渲染
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl p-10 shadow-2xl">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="text-slate-600 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 text-center mb-8">管理后台登录</h1>
          <form onSubmit={handleLogin} className="space-y-6">
            <input
              type="password"
              placeholder="请输入管理员密码"
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-400 transition-all"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-all"
            >
              进入系统
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 管理主界面渲染
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
            <Users className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">签到管理系统</h1>
        </div>
        <button 
          onClick={() => setIsAuthenticated(false)}
          className="flex items-center gap-2 text-slate-500 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">退出</span>
        </button>
      </header>

      <main className="p-8 max-w-7xl mx-auto">
        {/* 统计数据卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-2">当前签到总人数</p>
            <h2 className="text-5xl font-bold text-slate-800">{checkins.length}</h2>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <p className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-2">系统状态</p>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-emerald-600 font-bold">实时同步中</span>
            </div>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center">
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-3 bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
            >
              <Download className="w-5 h-5" />
              导出 Excel 报表
            </button>
          </div>
        </div>

        {/* 列表控制与搜索 */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-slate-800">签到人员列表</h3>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="搜索姓名、单位或手机号..."
                className="pl-12 pr-6 py-3 bg-slate-50 border-none rounded-xl w-full md:w-80 focus:ring-2 focus:ring-slate-200 transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* 签到数据表格 */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest">
                  <th className="px-8 py-4 font-semibold">姓名</th>
                  <th className="px-8 py-4 font-semibold">单位</th>
                  <th className="px-8 py-4 font-semibold">职务</th>
                  <th className="px-8 py-4 font-semibold">省份</th>
                  <th className="px-8 py-4 font-semibold">手机号</th>
                  <th className="px-8 py-4 font-semibold">签到时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCheckins.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-5 font-bold text-slate-800">{c.name}</td>
                    <td className="px-8 py-5 text-slate-600">{c.company}</td>
                    <td className="px-8 py-5 text-slate-600">{c.position}</td>
                    <td className="px-8 py-5 text-slate-600">{c.province}</td>
                    <td className="px-8 py-5 text-slate-500 font-mono">{c.phone}</td>
                    <td className="px-8 py-5 text-slate-400 text-sm">
                      {new Date(c.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {filteredCheckins.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-slate-400">
                      暂无签到数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
