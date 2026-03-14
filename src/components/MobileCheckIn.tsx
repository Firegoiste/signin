import { useState, FormEvent, useEffect } from 'react'; // 导入 React 钩子
import { motion, AnimatePresence } from 'motion/react'; // 导入动画库
import { User, Building2, Briefcase, Phone, MapPin } from 'lucide-react'; // 导入图标

// 预录入的用户数据
const MOCK_USERS = [
  { phone: '15601323970', name: '栾世杰', company: '外研社', position: '高手', province: '北京' }
];

export default function MobileCheckIn() {
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem('checkinData');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      name: '',
      company: '',
      position: '',
      phone: '',
      province: ''
    };
  });
  const [isSuccess, setIsSuccess] = useState(() => {
    return !!localStorage.getItem('checkinData');
  });
  const [isSubmitting, setIsSubmitting] = useState(false); // 是否正在提交状态
  const [error, setError] = useState(''); // 错误信息状态

  // 监听手机号输入，自动匹配信息
  useEffect(() => {
    if (formData.phone.length === 11) {
      const matchedUser = MOCK_USERS.find(u => u.phone === formData.phone);
      if (matchedUser) {
        setFormData(prev => ({
          ...prev,
          name: matchedUser.name,
          company: matchedUser.company,
          position: matchedUser.position,
          province: matchedUser.province || ''
        }));
      }
    }
  }, [formData.phone]);

  // 处理表单提交
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    
    // 表单验证
    if (!formData.name || !formData.company || !formData.position || !formData.phone || !formData.province) {
      setError('请填写所有必填字段');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      setError('请输入有效的11位手机号');
      return;
    }

    setIsSubmitting(true);
    try {
      // 调用签到接口
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('checkinData', JSON.stringify(formData));
        setIsSuccess(true); // 签到成功
      } else {
        setError(data.error || '提交失败，请重试');
      }
    } catch (err) {
      setError('网络错误，请稍后再试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 公共背景样式
  const pageBackground = "min-h-screen bg-gradient-to-br from-[#1a0505] via-[#380000] to-[#1a0505] flex flex-col font-sans text-[#fff0ad] relative overflow-hidden";
  
  // 公共 Logo 组件
  const Logo = () => (
    <div className="absolute top-6 left-6 z-20">
      <img 
        src="https://upload.wikimedia.org/wikipedia/zh/8/87/Foreign_Language_Teaching_and_Researching.png" 
        alt="外研社 Logo" 
        className="h-10 w-auto object-contain brightness-110 contrast-110"
        referrerPolicy="no-referrer"
      />
    </div>
  );

  // 公共 Footer 组件
  const Footer = () => (
    <div className="py-6 text-center px-6 mt-auto relative z-10">
      <p className="text-[#fff0ad]/40 text-[10px] tracking-wider">
        外研社·高等营销中心·解决方案部 © 2026
      </p>
    </div>
  );

  // 签到成功界面
  if (isSuccess) {
    return (
      <div className={pageBackground}>
        <Logo />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10">
          <div 
            className="text-[#fff0ad] text-3xl md:text-4xl font-bold drop-shadow-[0_0_20px_rgba(255,215,0,0.8)] text-center leading-relaxed"
            style={{ fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif' }}
          >
            欢迎 {formData.name} {formData.position} 参会
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // 签到表单界面
  return (
    <div className={pageBackground}>
      <Logo />
      
      {/* 头部标题 */}
      <div className="px-8 pt-24 pb-8 relative z-10">
        <motion.h1 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="text-3xl font-bold text-[#fff0ad]"
        >
          会议签到
        </motion.h1>
        <motion.p 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-[#fff0ad]/50 mt-2 text-sm"
        >
          请核对您的参会信息完成签到
        </motion.p>
      </div>

      {/* 表单内容 */}
      <div className="flex-1 px-8 py-4 relative z-10">
        <form onSubmit={handleSubmit} className="space-y-5 max-w-md mx-auto">
          <div className="space-y-4">
            {/* 手机号输入框 - 放在最上面，方便触发自动匹配 */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-[#fff0ad]/40 group-focus-within:text-[#fff0ad] transition-colors" />
              </div>
              <input
                type="tel"
                placeholder="请输入手机号"
                className="block w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#fff0ad]/30 focus:border-[#fff0ad]/30 transition-all text-[#fff0ad] placeholder:text-[#fff0ad]/20 outline-none"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            {/* 姓名输入框 */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-[#fff0ad]/40 group-focus-within:text-[#fff0ad] transition-colors" />
              </div>
              <input
                type="text"
                placeholder="姓名"
                className="block w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#fff0ad]/30 focus:border-[#fff0ad]/30 transition-all text-[#fff0ad] placeholder:text-[#fff0ad]/20 outline-none"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* 单位输入框 */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Building2 className="h-5 w-5 text-[#fff0ad]/40 group-focus-within:text-[#fff0ad] transition-colors" />
              </div>
              <input
                type="text"
                placeholder="单位"
                className="block w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#fff0ad]/30 focus:border-[#fff0ad]/30 transition-all text-[#fff0ad] placeholder:text-[#fff0ad]/20 outline-none"
                value={formData.company}
                onChange={e => setFormData({ ...formData, company: e.target.value })}
              />
            </div>

            {/* 职务输入框 */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Briefcase className="h-5 w-5 text-[#fff0ad]/40 group-focus-within:text-[#fff0ad] transition-colors" />
              </div>
              <input
                type="text"
                placeholder="职务"
                className="block w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#fff0ad]/30 focus:border-[#fff0ad]/30 transition-all text-[#fff0ad] placeholder:text-[#fff0ad]/20 outline-none"
                value={formData.position}
                onChange={e => setFormData({ ...formData, position: e.target.value })}
              />
            </div>

            {/* 省份输入框 */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <MapPin className="h-5 w-5 text-[#fff0ad]/40 group-focus-within:text-[#fff0ad] transition-colors" />
              </div>
              <input
                type="text"
                placeholder="省份"
                className="block w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#fff0ad]/30 focus:border-[#fff0ad]/30 transition-all text-[#fff0ad] placeholder:text-[#fff0ad]/20 outline-none"
                value={formData.province}
                onChange={e => setFormData({ ...formData, province: e.target.value })}
              />
            </div>
          </div>

          {/* 错误提示信息 */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-400 text-sm font-medium text-center"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-[#fff0ad] text-[#380000] rounded-2xl font-bold shadow-lg shadow-[#fff0ad]/10 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 mt-4"
          >
            {isSubmitting ? '提交中...' : '立即签到'}
          </button>
        </form>
      </div>

      <Footer />
    </div>
  );
}
