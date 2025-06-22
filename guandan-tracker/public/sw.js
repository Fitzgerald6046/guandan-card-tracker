/**
 * Service Worker for 掼蛋记牌器
 * 提供离线访问、缓存管理和后台同步功能
 */

const CACHE_NAME = 'guandan-tracker-v1.2.0';
const RUNTIME_CACHE = 'guandan-runtime-v1.2.0';

// 需要预缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/js/main.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // 字体文件
  '/static/media/font.woff2',
  // 关键页面
  '/game',
  '/analysis',
  '/history'
];

// 动态资源的缓存策略配置
const CACHE_STRATEGIES = {
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
};

// ==================== 安装事件 ====================

self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    (async () => {
      try {
        // 预缓存静态资源
        const cache = await caches.open(CACHE_NAME);
        console.log('[SW] Caching static assets...');
        
        // 分批缓存，避免一次性加载过多资源
        const batchSize = 5;
        for (let i = 0; i < STATIC_ASSETS.length; i += batchSize) {
          const batch = STATIC_ASSETS.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async url => {
              try {
                await cache.add(url);
                console.log(`[SW] Cached: ${url}`);
              } catch (error) {
                console.warn(`[SW] Failed to cache: ${url}`, error);
              }
            })
          );
        }
        
        console.log('[SW] Static assets cached successfully');
        
        // 跳过等待，立即激活
        await self.skipWaiting();
      } catch (error) {
        console.error('[SW] Install failed:', error);
      }
    })()
  );
});

// ==================== 激活事件 ====================

self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    (async () => {
      try {
        // 清理旧缓存
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(name => 
          name.startsWith('guandan-') && 
          name !== CACHE_NAME && 
          name !== RUNTIME_CACHE
        );
        
        await Promise.all(
          oldCaches.map(cacheName => {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          })
        );
        
        // 声明控制所有客户端
        await self.clients.claim();
        
        console.log('[SW] Service worker activated successfully');
        
        // 通知客户端SW已准备就绪
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            timestamp: Date.now()
          });
        });
        
      } catch (error) {
        console.error('[SW] Activation failed:', error);
      }
    })()
  );
});

// ==================== 网络请求拦截 ====================

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 只处理同源请求
  if (url.origin !== location.origin) {
    return;
  }
  
  // 跳过chrome-extension和其他特殊协议
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  event.respondWith(handleRequest(request));
});

/**
 * 处理网络请求
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  
  try {
    // 确定缓存策略
    const strategy = getCacheStrategy(url.pathname);
    
    switch (strategy.name) {
      case 'cache-first':
        return await cacheFirst(request, strategy);
      case 'network-first':
        return await networkFirst(request, strategy);
      case 'stale-while-revalidate':
        return await staleWhileRevalidate(request, strategy);
      default:
        return await networkFirst(request, strategy);
    }
  } catch (error) {
    console.error('[SW] Request handling failed:', error);
    return await handleOfflineFallback(request);
  }
}

/**
 * 确定缓存策略
 */
function getCacheStrategy(pathname) {
  // HTML页面 - 网络优先
  if (pathname === '/' || pathname.endsWith('.html')) {
    return { name: 'network-first', maxAge: 60 };
  }
  
  // 检查预定义策略
  for (const [name, config] of Object.entries(CACHE_STRATEGIES)) {
    if (config.pattern.test(pathname)) {
      return { name: config.strategy, maxAge: config.maxAge };
    }
  }
  
  // 默认策略
  return { name: 'network-first', maxAge: 300 };
}

/**
 * 缓存优先策略
 */
async function cacheFirst(request, strategy) {
  const cachedResponse = await getCachedResponse(request);
  
  if (cachedResponse && !isExpired(cachedResponse, strategy.maxAge)) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cacheResponse(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    if (cachedResponse) {
      console.log('[SW] Serving stale cache due to network error');
      return cachedResponse;
    }
    throw error;
  }
}

/**
 * 网络优先策略
 */
async function networkFirst(request, strategy) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cacheResponse(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await getCachedResponse(request);
    if (cachedResponse) {
      console.log('[SW] Serving cache due to network error');
      return cachedResponse;
    }
    throw error;
  }
}

/**
 * 后台更新策略
 */
async function staleWhileRevalidate(request, strategy) {
  const cachedResponse = await getCachedResponse(request);
  
  // 后台更新缓存
  const networkUpdate = fetch(request).then(async response => {
    if (response.ok) {
      await cacheResponse(request, response.clone());
    }
    return response;
  }).catch(error => {
    console.warn('[SW] Background update failed:', error);
  });
  
  // 立即返回缓存的响应（如果有）
  if (cachedResponse && !isExpired(cachedResponse, strategy.maxAge)) {
    return cachedResponse;
  }
  
  // 如果没有缓存或已过期，等待网络响应
  return await networkUpdate;
}

/**
 * 获取缓存的响应
 */
async function getCachedResponse(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  return await cache.match(request);
}

/**
 * 缓存响应
 */
async function cacheResponse(request, response) {
  // 只缓存成功的GET请求
  if (request.method !== 'GET' || !response.ok) {
    return;
  }
  
  const cache = await caches.open(RUNTIME_CACHE);
  
  // 添加时间戳到响应头
  const responseToCache = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'sw-cache-timestamp': Date.now().toString()
    }
  });
  
  await cache.put(request, responseToCache);
}

/**
 * 检查缓存是否过期
 */
function isExpired(response, maxAge) {
  const timestamp = response.headers.get('sw-cache-timestamp');
  if (!timestamp) return true;
  
  const age = (Date.now() - parseInt(timestamp)) / 1000;
  return age > maxAge;
}

/**
 * 离线回退处理
 */
async function handleOfflineFallback(request) {
  const url = new URL(request.url);
  
  // 导航请求返回离线页面
  if (request.mode === 'navigate') {
    const cache = await caches.open(CACHE_NAME);
    const offlinePage = await cache.match('/index.html');
    if (offlinePage) {
      return offlinePage;
    }
  }
  
  // 图片请求返回占位符
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp)$/)) {
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f0f0f0"/><text x="100" y="100" text-anchor="middle" dy="0.3em" font-family="sans-serif" font-size="14" fill="#999">离线模式</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
  
  // 其他请求返回通用错误
  return new Response(
    JSON.stringify({ 
      error: 'Network unavailable',
      message: '网络不可用，请检查连接'
    }), 
    { 
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// ==================== 后台同步 ====================

self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'game-data-sync') {
    event.waitUntil(syncGameData());
  } else if (event.tag === 'offline-actions-sync') {
    event.waitUntil(syncOfflineActions());
  }
});

/**
 * 同步游戏数据
 */
async function syncGameData() {
  try {
    console.log('[SW] Starting game data sync...');
    
    // 获取待同步的数据
    const pendingData = await getStoredData('pending_sync');
    if (!pendingData || pendingData.length === 0) {
      return;
    }
    
    // 批量同步数据
    const results = await Promise.allSettled(
      pendingData.map(data => syncSingleGameData(data))
    );
    
    // 处理同步结果
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`[SW] Sync completed: ${successful} successful, ${failed} failed`);
    
    // 清理已同步的数据
    if (successful > 0) {
      await clearStoredData('pending_sync');
    }
    
    // 通知客户端同步结果
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETED',
        successful,
        failed,
        timestamp: Date.now()
      });
    });
    
  } catch (error) {
    console.error('[SW] Game data sync failed:', error);
  }
}

/**
 * 同步单个游戏数据
 */
async function syncSingleGameData(data) {
  const response = await fetch('/api/games', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * 同步离线操作
 */
async function syncOfflineActions() {
  try {
    console.log('[SW] Starting offline actions sync...');
    
    const offlineActions = await getStoredData('offline_actions');
    if (!offlineActions || offlineActions.length === 0) {
      return;
    }
    
    // 按时间顺序执行离线操作
    offlineActions.sort((a, b) => a.timestamp - b.timestamp);
    
    for (const action of offlineActions) {
      try {
        await executeOfflineAction(action);
      } catch (error) {
        console.warn('[SW] Failed to sync offline action:', error);
      }
    }
    
    await clearStoredData('offline_actions');
    console.log('[SW] Offline actions sync completed');
    
  } catch (error) {
    console.error('[SW] Offline actions sync failed:', error);
  }
}

/**
 * 执行离线操作
 */
async function executeOfflineAction(action) {
  const { type, data, endpoint } = action;
  
  const response = await fetch(endpoint, {
    method: type === 'DELETE' ? 'DELETE' : 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error(`Action execution failed: ${response.status}`);
  }
  
  return await response.json();
}

// ==================== 数据存储工具 ====================

/**
 * 存储数据到IndexedDB
 */
async function storeData(key, data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GuandanSWData', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['data'], 'readwrite');
      const store = transaction.objectStore('data');
      
      const putRequest = store.put({ key, data, timestamp: Date.now() });
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data', { keyPath: 'key' });
      }
    };
  });
}

/**
 * 从IndexedDB获取数据
 */
async function getStoredData(key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GuandanSWData', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['data'], 'readonly');
      const store = transaction.objectStore('data');
      
      const getRequest = store.get(key);
      getRequest.onsuccess = () => {
        const result = getRequest.result;
        resolve(result ? result.data : null);
      };
      getRequest.onerror = () => reject(getRequest.error);
    };
  });
}

/**
 * 清理存储的数据
 */
async function clearStoredData(key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GuandanSWData', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['data'], 'readwrite');
      const store = transaction.objectStore('data');
      
      const deleteRequest = store.delete(key);
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

// ==================== 消息处理 ====================

self.addEventListener('message', event => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'CACHE_GAME_DATA':
      handleCacheGameData(data);
      break;
    case 'SCHEDULE_SYNC':
      handleScheduleSync(data);
      break;
    case 'CLEAR_CACHE':
      handleClearCache();
      break;
    case 'GET_CACHE_INFO':
      handleGetCacheInfo(event);
      break;
    default:
      console.warn('[SW] Unknown message type:', type);
  }
});

/**
 * 处理缓存游戏数据请求
 */
async function handleCacheGameData(data) {
  try {
    await storeData('game_data_cache', data);
    console.log('[SW] Game data cached successfully');
  } catch (error) {
    console.error('[SW] Failed to cache game data:', error);
  }
}

/**
 * 处理计划同步请求
 */
async function handleScheduleSync(data) {
  try {
    // 注册后台同步
    await self.registration.sync.register(data.tag || 'game-data-sync');
    console.log('[SW] Background sync scheduled');
  } catch (error) {
    console.error('[SW] Failed to schedule sync:', error);
  }
}

/**
 * 处理清理缓存请求
 */
async function handleClearCache() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('[SW] All caches cleared');
  } catch (error) {
    console.error('[SW] Failed to clear cache:', error);
  }
}

/**
 * 处理获取缓存信息请求
 */
async function handleGetCacheInfo(event) {
  try {
    const cacheNames = await caches.keys();
    const cacheInfo = {};
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      cacheInfo[cacheName] = keys.length;
    }
    
    event.ports[0].postMessage({
      type: 'CACHE_INFO',
      data: cacheInfo
    });
  } catch (error) {
    console.error('[SW] Failed to get cache info:', error);
  }
}

// ==================== 推送通知 ====================

self.addEventListener('push', event => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || '有新的游戏更新',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag || 'general',
      requireInteraction: false,
      actions: [
        {
          action: 'open',
          title: '查看详情'
        },
        {
          action: 'dismiss',
          title: '忽略'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || '掼蛋记牌器', options)
    );
  } catch (error) {
    console.error('[SW] Push notification error:', error);
  }
});

// 处理通知点击
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      self.clients.openWindow('/')
    );
  }
});

console.log('[SW] Service Worker script loaded successfully');