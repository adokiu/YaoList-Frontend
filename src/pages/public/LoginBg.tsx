interface LoginBgProps {
  darkMode?: boolean
}

export default function LoginBg({ darkMode = false }: LoginBgProps) {
  // 更柔和的配色方案
  const bgGradient = darkMode 
    ? 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0d1b2a 100%)'
    : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0f9ff 100%)'
  
  const primaryColor = darkMode ? '#1e3a5f' : '#0ea5e9'
  const secondaryColor = darkMode ? '#2d5a87' : '#38bdf8'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        background: bgGradient,
        overflow: 'hidden',
        zIndex: -1,
      }}
    >
      {/* 简约的单一曲线 - 底部 */}
      <svg
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '60%',
        }}
        viewBox="0 0 1440 600"
        preserveAspectRatio="none"
      >
        {/* 主曲线 - 优雅的贝塞尔曲线 */}
        <path
          d="M0,400 Q360,300 720,350 T1440,300 L1440,600 L0,600 Z"
          fill={primaryColor}
          opacity={darkMode ? 0.3 : 0.15}
        />
        {/* 次要曲线 - 更柔和 */}
        <path
          d="M0,450 Q480,350 960,420 T1440,380 L1440,600 L0,600 Z"
          fill={secondaryColor}
          opacity={darkMode ? 0.2 : 0.1}
        />
      </svg>

      {/* 顶部装饰曲线 - 极简 */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '30%',
        }}
        viewBox="0 0 1440 300"
        preserveAspectRatio="none"
      >
        <path
          d="M0,100 Q720,200 1440,80 L1440,0 L0,0 Z"
          fill={primaryColor}
          opacity={darkMode ? 0.2 : 0.08}
        />
      </svg>
    </div>
  )
}
