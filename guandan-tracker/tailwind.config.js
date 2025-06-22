/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'player-1': '#3b82f6', // 蓝色
        'player-2': '#10b981', // 绿色  
        'player-3': '#f59e0b', // 黄色
        'player-4': '#ef4444', // 红色
        'rank-card': '#fbbf24', // 级牌金色
        'wild-card': '#dc2626', // 配牌红色
      },
      gridTemplateColumns: {
        '13': 'repeat(13, minmax(0, 1fr))',
        '14': 'repeat(14, minmax(0, 1fr))',
        '15': 'repeat(15, minmax(0, 1fr))',
        '16': 'repeat(16, minmax(0, 1fr))',
        '17': 'repeat(17, minmax(0, 1fr))',
        '18': 'repeat(18, minmax(0, 1fr))',
        '19': 'repeat(19, minmax(0, 1fr))',
        '20': 'repeat(20, minmax(0, 1fr))',
        '21': 'repeat(21, minmax(0, 1fr))',
        '22': 'repeat(22, minmax(0, 1fr))',
        '23': 'repeat(23, minmax(0, 1fr))',
        '24': 'repeat(24, minmax(0, 1fr))',
        '25': 'repeat(25, minmax(0, 1fr))',
        '26': 'repeat(26, minmax(0, 1fr))',
        '27': 'repeat(27, minmax(0, 1fr))',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-soft': 'bounceSoft 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bounceSoft: {
          '0%, 20%, 53%, 80%, 100%': { transform: 'translate3d(0,0,0)' },
          '40%, 43%': { transform: 'translate3d(0,-8px,0)' },
          '70%': { transform: 'translate3d(0,-4px,0)' },
          '90%': { transform: 'translate3d(0,-2px,0)' },
        },
      },
    },
  },
  plugins: [],
}