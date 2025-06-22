# 掼蛋记牌器 PWA 功能文档

完整的PWA (Progressive Web App) 功能实现，包含离线访问、安装提示、更新管理和性能优化。

## 📁 文件结构

```
src/
├── hooks/
│   └── usePWA.ts                 # PWA功能管理Hook
├── components/
│   ├── PWAWrapper.tsx            # PWA功能集成包装组件
│   ├── PWAInstallPrompt.tsx      # 安装提示组件
│   ├── PWAUpdateBanner.tsx       # 更新横幅组件
│   ├── LazyImage.tsx            # 懒加载图片组件
│   └── DataExport.tsx           # 数据导出组件
├── utils/
│   ├── codesplitting.ts         # 代码分割工具
│   └── resourcePreloader.ts      # 资源预加载工具
└── public/
    └── sw.js                    # Service Worker
```

## 🎯 核心功能

### 1. Service Worker配置 (public/sw.js)

#### 主要功能
- ✅ **静态资源缓存** - 预缓存HTML、CSS、JS等关键资源
- ✅ **动态缓存策略** - 缓存优先、网络优先、后台更新等策略
- ✅ **离线访问支持** - 网络不可用时提供缓存内容
- ✅ **后台数据同步** - 网络恢复时自动同步离线操作
- ✅ **推送通知** - 支持应用更新和游戏通知

#### 缓存策略

```javascript
// 图片资源 - 缓存优先
images: {
  pattern: /\.(png|jpg|jpeg|gif|webp|svg)$/,
  strategy: 'cache-first',
  maxAge: 30 * 24 * 60 * 60 // 30天
},

// API请求 - 网络优先
api: {
  pattern: /\/api\//,
  strategy: 'network-first',
  maxAge: 5 * 60 // 5分钟
},

// 静态资源 - 缓存优先
static: {
  pattern: /\/(static|assets)\//,
  strategy: 'cache-first',
  maxAge: 7 * 24 * 60 * 60 // 7天
}
```

#### 后台同步

```javascript
// 注册后台同步
self.registration.sync.register('game-data-sync');

// 处理同步事件
self.addEventListener('sync', event => {
  if (event.tag === 'game-data-sync') {
    event.waitUntil(syncGameData());
  }
});
```

### 2. PWA管理Hook (usePWA.ts)

#### 主要功能
- ✅ **安装提示管理** - 检测平台类型，提供定制化安装引导
- ✅ **更新检测和应用** - 自动检查更新，提供手动更新选项
- ✅ **离线状态监控** - 监听网络状态，管理离线数据同步
- ✅ **Service Worker生命周期** - 管理SW注册、激活、更新等状态

#### 使用示例

```typescript
import { usePWA } from '../hooks/usePWA';

function App() {
  const {
    install,          // 安装相关信息
    update,           // 更新相关信息
    offline,          // 离线相关信息
    serviceWorker,    // SW相关信息
    triggerInstall,   // 触发安装
    checkForUpdate,   // 检查更新
    applyUpdate,      // 应用更新
    syncData,         // 同步数据
    clearCache        // 清理缓存
  } = usePWA();

  return (
    <div>
      {/* 应用内容 */}
      {install.showInstallPrompt && (
        <button onClick={triggerInstall}>
          安装应用
        </button>
      )}
      
      {update.hasUpdate && (
        <button onClick={applyUpdate}>
          更新应用
        </button>
      )}
    </div>
  );
}
```

### 3. 安装提示组件 (PWAInstallPrompt.tsx)

#### 平台适配
- ✅ **iOS Safari** - 详细的手动安装步骤指导
- ✅ **Android Chrome** - 原生安装提示 + 手动指导
- ✅ **桌面浏览器** - 原生安装提示

#### iOS安装步骤

```typescript
const IOS_INSTALL_STEPS = [
  {
    icon: '📱',
    title: '点击分享按钮',
    description: '在Safari浏览器底部找到分享按钮'
  },
  {
    icon: '⬆️',
    title: '选择"添加到主屏幕"',
    description: '在分享菜单中向下滑动找到此选项'
  },
  {
    icon: '✅',
    title: '确认添加',
    description: '点击"添加"完成安装'
  }
];
```

#### 使用示例

```typescript
import PWAInstallPrompt from './PWAInstallPrompt';

<PWAInstallPrompt
  installInfo={pwa.install}
  onInstall={pwa.triggerInstall}
  onClose={() => console.log('Install prompt closed')}
  autoShow={true}
/>
```

### 4. 更新横幅组件 (PWAUpdateBanner.tsx)

#### 主要功能
- ✅ **更新状态显示** - 检测到更新时显示横幅
- ✅ **自动更新检查** - 每30分钟检查一次更新
- ✅ **更新进度反馈** - 显示更新状态和进度
- ✅ **开发者工具** - 开发环境下的调试功能

#### 使用示例

```typescript
import PWAUpdateBanner from './PWAUpdateBanner';

<PWAUpdateBanner
  updateInfo={pwa.update}
  serviceWorkerInfo={pwa.serviceWorker}
  onUpdate={pwa.applyUpdate}
  onCheckUpdate={pwa.checkForUpdate}
  onClearCache={pwa.clearCache}
/>
```

### 5. 性能优化

#### 图片懒加载 (LazyImage.tsx)

```typescript
import LazyImage from './LazyImage';

<LazyImage
  src="/images/card.jpg"
  alt="卡牌图片"
  placeholder={<CardPlaceholder />}
  errorPlaceholder={<ErrorPlaceholder />}
  rootMargin="50px"
  onLoad={() => console.log('Image loaded')}
  onError={(error) => console.warn('Image failed:', error)}
/>
```

#### 代码分割 (codesplitting.ts)

```typescript
import { createLazyComponent } from '../utils/codesplitting';

// 创建懒加载组件
const LazyGameAnalysis = createLazyComponent(
  () => import('./GameAnalysis'),
  'game-analysis',
  { preload: 'hover' }
);

// 预加载策略
preloadOnInteraction(element, importFn, 'hover');
preloadOnVisible(element, importFn);
preloadOnIdle(importFn);
```

#### 资源预加载 (resourcePreloader.ts)

```typescript
import { preloadCriticalResources, smartPreload } from '../utils/resourcePreloader';

// 预加载关键资源
await preloadCriticalResources();

// 智能预加载（根据网络条件）
await smartPreload();

// 自定义资源预加载
const result = await preloadResource({
  url: '/images/important.jpg',
  type: 'image',
  priority: 'high',
  critical: true
});
```

### 6. PWA集成包装器 (PWAWrapper.tsx)

#### 统一管理
- ✅ **功能集成** - 统一管理所有PWA功能
- ✅ **状态监控** - 实时监控PWA状态和性能
- ✅ **调试信息** - 开发环境下的详细状态显示
- ✅ **自动初始化** - 自动初始化所有PWA功能

#### 使用示例

```typescript
import PWAWrapper from './PWAWrapper';

function App() {
  return (
    <PWAWrapper
      enableInstallPrompt={true}
      enableUpdateBanner={true}
      enableResourcePreload={true}
      showDebugInfo={process.env.NODE_ENV === 'development'}
    >
      <YourAppComponents />
    </PWAWrapper>
  );
}
```

## 🚀 部署配置

### 1. Manifest文件配置

```json
{
  "name": "掼蛋记牌器",
  "short_name": "掼蛋记牌器",
  "description": "专业的掼蛋记牌工具，支持离线使用",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "orientation": "portrait",
  "categories": ["games", "utilities"],
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 2. 服务器配置

```nginx
# nginx配置
location / {
  try_files $uri $uri/ /index.html;
  
  # 设置缓存头
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
  
  # Service Worker不缓存
  location /sw.js {
    expires 0;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
  }
}

# 启用HTTPS（PWA要求）
server {
  listen 443 ssl http2;
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
}
```

### 3. HTTPS要求

PWA功能需要HTTPS环境（localhost除外）：

```javascript
// 检查HTTPS
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  console.warn('PWA requires HTTPS');
}
```

## 📊 性能监控

### 1. Core Web Vitals

```typescript
// 监控关键性能指标
const observer = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    if (entry.entryType === 'largest-contentful-paint') {
      console.log('LCP:', entry.startTime);
    }
    if (entry.entryType === 'first-input') {
      console.log('FID:', entry.processingStart - entry.startTime);
    }
  });
});

observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] });
```

### 2. 缓存性能

```typescript
// 监控缓存命中率
const cacheInfo = await getCacheInfo();
console.log('缓存命中率:', cacheInfo.hitRate);
console.log('缓存大小:', cacheInfo.totalSize);
```

### 3. 网络性能

```typescript
// 监控网络状态
const networkInfo = navigator.connection;
console.log('网络类型:', networkInfo.effectiveType);
console.log('下行速度:', networkInfo.downlink);
console.log('延迟:', networkInfo.rtt);
```

## 🔧 开发和调试

### 1. 开发环境配置

```javascript
// vite.config.ts
export default defineConfig({
  plugins: [
    react(),
    // PWA插件配置
    VitePWA({
      registerType: 'manual',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 300
              }
            }
          }
        ]
      }
    })
  ]
});
```

### 2. 调试工具

```typescript
// 开发环境下的PWA调试
if (process.env.NODE_ENV === 'development') {
  // 显示详细的PWA状态
  console.log('PWA Debug Info:', {
    serviceWorker: pwa.serviceWorker,
    install: pwa.install,
    update: pwa.update,
    offline: pwa.offline
  });
  
  // 暴露调试方法到全局
  (window as any).pwaDebug = {
    triggerInstall: pwa.triggerInstall,
    checkUpdate: pwa.checkForUpdate,
    clearCache: pwa.clearCache,
    syncData: pwa.syncData
  };
}
```

### 3. 测试

```bash
# 本地HTTPS测试
npm run build
npx serve -s dist --ssl-cert cert.pem --ssl-key key.pem

# Lighthouse PWA审计
lighthouse https://localhost:5000 --view

# Workbox测试
npx workbox generateSW workbox-config.js
```

## 📱 平台兼容性

| 功能 | Chrome | Safari | Firefox | Edge |
|------|--------|--------|---------|------|
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Web App Manifest | ✅ | ✅ | ✅ | ✅ |
| Install Prompt | ✅ | ⚠️ | ✅ | ✅ |
| Push Notifications | ✅ | ✅ | ✅ | ✅ |
| Background Sync | ✅ | ❌ | ❌ | ✅ |

⚠️ Safari需要手动安装  
❌ 不支持该功能

## 🎯 最佳实践

### 1. 缓存策略
- 关键资源使用缓存优先策略
- API数据使用网络优先策略
- 静态资源设置长期缓存

### 2. 用户体验
- 提供清晰的安装引导
- 及时显示更新提醒
- 优雅处理离线状态

### 3. 性能优化
- 预加载关键资源
- 懒加载非关键组件
- 监控性能指标

### 4. 错误处理
- 网络请求失败回退
- Service Worker错误恢复
- 缓存清理机制

## ✨ 总结

这套PWA功能实现提供了完整的离线体验：

1. ✅ **完整的Service Worker** - 智能缓存和离线支持
2. ✅ **平台适配的安装提示** - iOS/Android/Desktop定制化引导
3. ✅ **自动更新管理** - 检测更新并提供用户友好的更新体验
4. ✅ **性能优化** - 图片懒加载、代码分割、资源预加载
5. ✅ **状态监控** - 网络状态、电池状态、性能指标监控
6. ✅ **开发友好** - 完整的调试工具和开发环境支持

可以直接集成到掼蛋记牌器项目中，提供原生应用级别的用户体验。