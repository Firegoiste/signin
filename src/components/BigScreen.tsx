import { useEffect, useRef, useState } from 'react'; // 导入 React 钩子
import * as THREE from 'three'; // 导入 Three.js 核心库
import { QRCodeSVG } from 'qrcode.react'; // 导入二维码生成组件
import { io } from 'socket.io-client'; // 导入 Socket.io 客户端
import { motion, AnimatePresence } from 'motion/react'; // 导入动画库
import { ShaderGradientCanvas, ShaderGradient } from 'shadergradient'; // 导入着色器渐变背景组件

const ShaderGradientAny = ShaderGradient as any; // 解决类型定义问题

// 定义签到数据接口
interface Checkin {
  id: number;
  name: string;
  position: string;
}

export default function BigScreen() {
  const mountRef = useRef<HTMLDivElement>(null); // Three.js 挂载容器引用
  const audioRef = useRef<HTMLAudioElement | null>(null); // 背景音乐引用
  const [checkins, setCheckins] = useState<Checkin[]>([]); // 签到列表状态
  const [lastCheckin, setLastCheckin] = useState<Checkin | null>(null); // 最近一次签到状态
  const [checkinQueue, setCheckinQueue] = useState<Checkin[]>([]); // 签到队列
  const [isAnimating, setIsAnimating] = useState(false); // 是否正在执行签到动画
  const checkinUrl = window.location.origin + '/checkin'; // 签到二维码链接
  
  // Three.js 相关引用
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sphereRef = useRef<THREE.Group | null>(null);
  const flyingGroupRef = useRef<THREE.Group | null>(null);
  const clockRef = useRef<THREE.Clock | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // 清理现有内容，防止重复渲染
    mountRef.current.innerHTML = '';

    // 场景初始化
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    // 摄像机设置
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 6;
    cameraRef.current = camera;

    // 渲染器设置
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 主球体分组
    const sphereGroup = new THREE.Group();
    scene.add(sphereGroup);
    sphereRef.current = sphereGroup;

    // 飞入粒子分组
    const flyingGroup = new THREE.Group();
    scene.add(flyingGroup);
    flyingGroupRef.current = flyingGroup;

    // 球体粒子（金色）
    const logoData = (window as any).IMAGE_MODELS?.['fff'];
    const sphereParticlesCount = logoData ? logoData.count : 15000; // 使用新模型的粒子数
    const spherePos = new Float32Array(sphereParticlesCount * 3); // 当前位置
    const targetPos = new Float32Array(sphereParticlesCount * 3); // 目标位置
    const twinkleFactors = new Float32Array(sphereParticlesCount); // 闪烁因子
    
    // 初始化粒子位置并加载 Logo 目标点位
    for (let i = 0; i < sphereParticlesCount; i++) {
      // 初始位置随机分布在一个小球体内
      const r = Math.random() * 2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      spherePos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      spherePos[i * 3 + 1] = r * Math.cos(phi);
      spherePos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      
      // 设置目标位置（从 foreignlanguageteachingandresearching_data.js 读取）
      if (logoData && logoData.positions) {
        // 缩放系数 0.45 使 Logo 大小适中
        const scale = 0.45;
        targetPos[i * 3] = logoData.positions[i * 3] * scale;
        targetPos[i * 3 + 1] = logoData.positions[i * 3 + 1] * scale;
        targetPos[i * 3 + 2] = logoData.positions[i * 3 + 2] * scale;
      } else {
        targetPos[i * 3] = spherePos[i * 3];
        targetPos[i * 3 + 1] = spherePos[i * 3 + 1];
        targetPos[i * 3 + 2] = spherePos[i * 3 + 2];
      }

      twinkleFactors[i] = Math.random();
    }

    // 粒子几何体属性设置
    const spherePartGeo = new THREE.BufferGeometry();
    spherePartGeo.setAttribute('position', new THREE.BufferAttribute(spherePos, 3));
    spherePartGeo.setAttribute('twinkle', new THREE.BufferAttribute(twinkleFactors, 1));
    const spherePartMat = new THREE.PointsMaterial({
      size: 0.018, // 粒子大小
      color: 0xffbd00, // 粒子颜色：深金橘色
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    // 注入自定义着色器逻辑，实现不同频率的闪烁效果
    spherePartMat.onBeforeCompile = (shader) => {
      shader.uniforms.time = { value: 0 };
      shader.vertexShader = `
        attribute float twinkle;
        varying float vTwinkle;
        ${shader.vertexShader}
      `.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vTwinkle = twinkle;`
      );
      shader.fragmentShader = `
        uniform float time;
        varying float vTwinkle;
        ${shader.fragmentShader}
      `.replace(
        '#include <output_fragment>',
        `
        // 根据每个粒子的 twinkle 属性改变闪烁频率和相位，频率翻倍
        float t = time * (3.0 + vTwinkle * 6.0) + vTwinkle * 6.28;
        float twinkleFactor = 0.4 + 0.6 * pow(0.5 + 0.5 * sin(t), 2.0);
        gl_FragColor.a *= twinkleFactor;
        #include <output_fragment>
        `
      );
      spherePartMat.userData.shader = shader;
    };
    const spherePoints = new THREE.Points(spherePartGeo, spherePartMat);
    sphereGroup.add(spherePoints);

    // 动画循环
    const clock = new THREE.Clock();
    clockRef.current = clock;
    const animate = () => {
      requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      
      // 30 秒一个循环的散射动画，聚拢后保持 5 秒
      const totalCycle = 30;
      const holdTime = 5;
      const animTime = totalCycle - holdTime;
      const elapsedInCycle = elapsed % totalCycle;
      
      let scatterFactor = 0;
      if (elapsedInCycle < animTime) {
        const animProgress = elapsedInCycle / animTime;
        scatterFactor = Math.pow(Math.sin(animProgress * Math.PI), 2);
      } else {
        scatterFactor = 0; // 保持聚拢状态
      }

      // 更新粒子位置，向目标位置平滑移动，并加入散射效果
      const positions = spherePartGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < sphereParticlesCount; i++) {
        const i3 = i * 3;
        // 散射时粒子向外扩张
        const tx = targetPos[i3] * (1 + scatterFactor * 5);
        const ty = targetPos[i3 + 1] * (1 + scatterFactor * 5);
        const tz = targetPos[i3 + 2] * (1 + scatterFactor * 5);
        
        positions[i3] += (tx - positions[i3]) * 0.05;
        positions[i3 + 1] += (ty - positions[i3 + 1]) * 0.05;
        positions[i3 + 2] += (tz - positions[i3 + 2]) * 0.05;
      }
      spherePartGeo.attributes.position.needsUpdate = true;

      // 更新飞入粒子动画
      if (flyingGroupRef.current) {
        flyingGroupRef.current.children.forEach((child) => {
          if (child instanceof THREE.Sprite && child.userData.targetPos) {
            const data = child.userData;
            // 向目标位置平滑移动
            child.position.lerp(data.targetPos, 0.02);
            // 添加漂浮感
            child.position.x += Math.sin(elapsed * 3 + data.randomOffset) * 0.005;
            child.position.y += Math.cos(elapsed * 2 + data.randomOffset) * 0.005;
            // 缩放插值（越远越小）
            child.scale.lerp(data.targetScale, 0.02);
            
            // 生命周期后期的淡出效果
            const age = elapsed - data.spawnTime;
            if (age > 8) { // 10秒生命周期，最后2秒淡出
              child.material.opacity = Math.max(0, 1 - (age - 8) / 2);
            }
          }
        });
      }

      // 更新着色器时间变量
      if (spherePartMat.userData.shader) {
        spherePartMat.userData.shader.uniforms.time.value = elapsed;
      }

      // 呼吸灯效果（全局透明度调制）
      const breathing = 0.7 + 0.3 * Math.sin(elapsed * 1.5);
      spherePartMat.opacity = breathing;

      sphereGroup.rotation.y += 0.005; // 球体自转
      // 移除圆环旋转
      renderer.render(scene, camera);
    };
    animate();

    // 处理窗口缩放
    const handleResize = () => {
      if (!rendererRef.current || !cameraRef.current) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    const handleFullscreenChange = () => {
      // 延迟处理以确保浏览器已更新尺寸
      setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Socket 连接初始化
    const socket = io({
      path: "/socket.io/",
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('大屏已连接到 Socket 服务器');
    });

    socket.on('connect_error', (err) => {
      console.warn('大屏 Socket 连接错误:', err.message);
    });

    // 监听新签到事件
    socket.on('new-checkin', (data: Checkin) => {
      setCheckins(prev => [...prev.slice(-49), data]); // 保留最近 50 条
      setCheckinQueue(prev => [...prev, data]); // 加入队列
    });

    // 组件卸载时清理资源
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      socket.disconnect();
      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
      renderer.dispose();
      spherePartGeo.dispose();
      spherePartMat.dispose();
    };
  }, []);

  // 处理签到队列
  useEffect(() => {
    if (checkinQueue.length > 0 && !lastCheckin && !isAnimating) {
      const nextCheckin = checkinQueue[0];
      setCheckinQueue(prev => prev.slice(1));
      setLastCheckin(nextCheckin);
      setIsAnimating(true);

      // 3秒展示
      setTimeout(() => {
        setLastCheckin(null); // 触发 1.5s 缩小动画
        
        // 1.5秒缩小动画结束后
        setTimeout(() => {
          spawnFlyingParticle(); // 生成十字星光粒子
          setIsAnimating(false); // 允许处理下一个
        }, 1500);
      }, 3000);
    }
  }, [checkinQueue, lastCheckin, isAnimating]);

  // 将签到转化为十字星光粒子飞入背景
  const spawnFlyingParticle = () => {
    if (!flyingGroupRef.current || !clockRef.current) return;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.width = 256;
    canvas.height = 256;
    
    const cx = 128;
    const cy = 128;

    // 绘制发光十字星光
    context.save();
    context.translate(cx, cy);
    context.beginPath();
    const starRadiusX = 120;
    const starRadiusY = 120;
    context.moveTo(0, -starRadiusY);
    context.quadraticCurveTo(0, 0, starRadiusX, 0);
    context.quadraticCurveTo(0, 0, 0, starRadiusY);
    context.quadraticCurveTo(0, 0, -starRadiusX, 0);
    context.quadraticCurveTo(0, 0, 0, -starRadiusY);
    context.closePath();
    
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 120);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 215, 0, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    
    context.fillStyle = gradient;
    context.shadowBlur = 30;
    context.shadowColor = '#ffffff';
    context.fill();
    context.restore();

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
      map: texture, 
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 1 // 初始完全可见，因为是从缩小的文字变来的
    });
    const sprite = new THREE.Sprite(spriteMaterial);

    // 初始位置：屏幕下方中心，靠近摄像机
    sprite.position.set(0, -2, 4); 
    sprite.scale.set(1.5, 1.5, 1);

    // 目标位置：背景球体内的随机位置
    const r = Math.random() * 2;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const targetX = r * Math.sin(phi) * Math.cos(theta);
    const targetY = r * Math.cos(phi);
    const targetZ = r * Math.sin(phi) * Math.sin(theta);

    // 存储目标状态和动画数据
    sprite.userData = {
      targetPos: new THREE.Vector3(targetX, targetY, targetZ),
      targetScale: new THREE.Vector3(0.4, 0.4, 1),
      spawnTime: clockRef.current.getElapsedTime(),
      randomOffset: Math.random() * Math.PI * 2
    };

    flyingGroupRef.current.add(sprite);

    // 10秒后移除粒子
    setTimeout(() => {
      if (flyingGroupRef.current) {
        flyingGroupRef.current.remove(sprite);
      }
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }, 10000);
  };

  // 测试功能：全屏模式下按 X 调出栾世杰的信息进行测试，按 M 播放/暂停音乐
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'x' || e.key === 'X') && document.fullscreenElement) {
        const testData = { id: Date.now(), name: '栾世杰', position: '嘉宾' };
        setCheckinQueue(prev => [...prev, testData]);
      }
      if (e.key === 'm' || e.key === 'M') {
        if (audioRef.current) {
          if (audioRef.current.paused) {
            audioRef.current.play().catch(err => console.error("播放音乐失败:", err));
          } else {
            audioRef.current.pause();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 切换全屏
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`无法进入全屏模式: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden font-serif">
      {/* 背景音乐 */}
      <audio ref={audioRef} src="/bgm.mp3" loop autoPlay preload="auto" />

      {/* 全屏切换按钮 */}
      <button 
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-50 p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors pointer-events-auto group"
        title="全屏切换"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff0ad" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 group-hover:opacity-100">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      </button>

      {/* 背景着色器渐变 */}
      <div className="absolute inset-0 z-0">
        <ShaderGradientCanvas
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          fov={40}
          pixelDensity={1.3}
        >
          <ShaderGradientAny
            animate="on"
            axesHelper="off"
            brightness={3.5}
            cAzimuthAngle={180}
            cDistance={2.59}
            cPolarAngle={90}
            cameraZoom={1}
            color1="#380000"
            color2="#cb221c"
            color3="#f27724"
            destination="onCanvas"
            embedMode="off"
            envPreset="lobby"
            format="gif"
            fov={40}
            frameRate={10}
            gizmoHelper="hide"
            grain="off"
            lightType="3d"
            pixelDensity={1.3}
            positionX={-1.4}
            positionY={0}
            positionZ={0}
            range="disabled"
            rangeEnd={40}
            rangeStart={0}
            reflection={0.1}
            rotationX={0}
            rotationY={10}
            rotationZ={50}
            shader="defaults"
            type="waterPlane"
            uAmplitude={1}
            uDensity={1.2}
            uFrequency={5.5}
            uSpeed={0.2}
            uStrength={2.2}
            uTime={0}
            wireframe={false}
          />
        </ShaderGradientCanvas>
      </div>
      
      {/* 3D 前景（球体与圆环）挂载点 */}
      <div ref={mountRef} className="absolute inset-0 z-5" />

      {/* UI 叠加层 */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-between py-12 pointer-events-none">
        {/* Logo - 左上角 */}
        <div className="absolute top-8 left-8">
          <img 
            src="https://upload.wikimedia.org/wikipedia/zh/8/87/Foreign_Language_Teaching_and_Researching.png" 
            alt="外研社 Logo" 
            className="h-20 w-auto object-contain brightness-110 contrast-110"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* 顶部：标题 */}
        <div className="w-full flex justify-center px-12">
          <motion.h1 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-5xl font-bold text-[#fff0ad] tracking-tight drop-shadow-[0_0_30px_rgba(255,215,0,0.6)] text-center whitespace-nowrap"
          >
            第十届高等学校外语教育改革与发展论坛
          </motion.h1>
        </div>

        {/* 中间：二维码（居中于球体）- 采用毛玻璃风格 */}
        <div className="flex-1 flex flex-col items-center justify-center relative w-full">
          <div className="relative z-30 pointer-events-auto">
            {/* 毛玻璃容器 (对应用户提供的 .glass 样式，形状改为圆角矩形) */}
            <div 
              className="w-[20rem] h-[22rem] rounded-[3rem] flex flex-col items-center justify-start pt-[1.875rem] relative overflow-hidden transition-transform hover:scale-105 duration-500 group"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.02) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: `
                  0 20px 50px rgba(0, 0, 0, 0.2),
                  inset 0 2px 4px rgba(255, 255, 255, 0.2),
                  inset 0 -2px 4px rgba(0, 0, 0, 0.1)
                `,
                backdropFilter: 'blur(16px) saturate(180%)',
                WebkitBackdropFilter: 'blur(16px) saturate(180%)',
              }}
            >
              {/* 装饰线条 (对应 CSS 的 ::before 和 ::after) */}
              <div className="absolute w-[40%] h-[10px] bg-white rounded-[10px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10" />
              <div className="absolute w-[40%] h-[10px] bg-white rounded-[10px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 opacity-10" />

              {/* 二维码主体 */}
              <div className="relative z-10 bg-white p-5 rounded-3xl shadow-2xl">
                <QRCodeSVG value={checkinUrl} size={220} level="H" />
              </div>

              {/* 文字标签 - 居中于底部剩余空间 */}
              <div className="flex-1 flex items-center justify-center w-full">
                <div 
                  className="text-white text-2xl font-bold tracking-[0.4em] uppercase"
                  style={{ fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif' }}
                >
                  扫码签到
                </div>
              </div>
            </div>
          </div>

          {/* 新签到通知（移动到玻璃框底部居中） */}
          <div className="absolute bottom-0 w-full flex items-center justify-center h-24">
            <AnimatePresence>
              {lastCheckin && (
                <motion.div
                  key={lastCheckin.id}
                  initial={{ y: 20, opacity: 0, scale: 0.9 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ scale: 0, opacity: 0, transition: { duration: 1.5, ease: "easeInOut" } }}
                  className="flex flex-col items-center justify-center"
                >
                  <div 
                    className="text-[#fff0ad] text-4xl font-bold drop-shadow-[0_0_20px_rgba(255,215,0,0.8)]"
                    style={{ fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif' }}
                  >
                    欢迎 {lastCheckin.name} {lastCheckin.position} 参会
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 底部：页脚 */}
        <div className="flex flex-col items-center gap-8 w-full px-12">
          <div className="flex justify-between items-end w-full text-[#fff0ad]/50 text-xs font-serif">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[#fff0ad]/30 [clip-path:polygon(50%_0%,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)]" />
              <span className="tabular-nums">北京 · 2026</span>
            </div>
            <div className="text-right tabular-nums">
              外研社·高等营销中心·解决方案部 © 2026
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
