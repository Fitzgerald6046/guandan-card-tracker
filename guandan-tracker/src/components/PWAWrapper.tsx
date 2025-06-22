/**
 * PWA功能集成包装组件
 * 统一管理PWA的所有功能，包括安装提示、更新横幅、性能优化等
 */

import React, { useEffect, useState } from 'react';
import { usePWA } from '../hooks/usePWA';
import { useResourcePreloader, smartPreload } from '../utils/resourcePreloader';
import PWAInstallPrompt from './PWAInstallPrompt';
import PWAUpdateBanner from './PWAUpdateBanner';

// ==================== 类型定义 ====================

interface PWAWrapperProps {
  /** 子组件 */
  children: React.ReactNode;
  /** 是否启用安装提示 */
  enableInstallPrompt?: boolean;
  /** 是否启用更新横幅 */
  enableUpdateBanner?: boolean;
  /** 是否启用资源预加载 */
  enableResourcePreload?: boolean;
  /** 是否在开发环境显示调试信息 */
  showDebugInfo?: boolean;
}

interface PWAStatus {
  isOnline: boolean;
  isInstalled: boolean;
  hasUpdate: boolean;
  isUpdating: boolean;
  lastSyncTime: number | null;
}

// ==================== 工具函数 ====================

/**
 * 检查是否在PWA模式下运行
 */
function isPWAMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * 检查是否支持PWA功能
 */
function isPWASupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'manifest' in document.documentElement &&
    'PushManager' in window
  );
}

// ==================== 主组件 ====================

export const PWAWrapper: React.FC<PWAWrapperProps> = ({
  children,
  enableInstallPrompt = true,
  enableUpdateBanner = true,
  enableResourcePreload = true,
  showDebugInfo = process.env.NODE_ENV === 'development'
}) => {
  const pwa = usePWA();
  const resourcePreloader = useResourcePreloader();
  
  const [pwaStatus, setPwaStatus] = useState<PWAStatus>({
    isOnline: navigator.onLine,
    isInstalled: isPWAMode(),
    hasUpdate: false,
    isUpdating: false,
    lastSyncTime: null
  });
  
  const [performanceMetrics, setPerformanceMetrics] = useState({
    loadTime: 0,
    firstContentfulPaint: 0,
    firstInputDelay: 0,
    cumulativeLayoutShift: 0
  });
  
  // ==================== 初始化和清理 ====================
  
  useEffect(() => {
    // 初始化PWA功能
    initializePWA();
    
    // 设置性能监控
    setupPerformanceMonitoring();
    
    // 设置网络状态监听
    setupNetworkListener();
    
    // 预加载关键资源
    if (enableResourcePreload) {
      smartPreload().catch(console.warn);
    }
    
    return () => {
      // 清理工作
      console.log('[PWA] Wrapper unmounted');
    };
  }, [enableResourcePreload]);
  
  // ==================== PWA初始化 ====================
  
  const initializePWA = async () => {
    try {
      console.log('[PWA] Initializing PWA functionality...');
      
      // 检查PWA支持
      if (!isPWASupported()) {
        console.warn('[PWA] PWA features not supported');
        return;
      }
      
      // 设置PWA事件监听
      setupPWAEventListeners();
      
      // 注册推送通知（如果支持）
      await registerPushNotifications();
      
      console.log('[PWA] PWA initialization completed');
    } catch (error) {
      console.error('[PWA] Failed to initialize PWA:', error);
    }
  };
  
  const setupPWAEventListeners = () => {
    // 监听应用安装事件
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      setPwaStatus(prev => ({ ...prev, isInstalled: true }));
      
      // 发送安装成功事件到分析服务
      if ('gtag' in window) {
        (window as any).gtag('event', 'pwa_install', {
          event_category: 'PWA',
          event_label: 'Installation Success'
        });
      }
    });
    
    // 监听beforeunload事件，保存数据
    window.addEventListener('beforeunload', () => {
      // 保存当前状态到本地存储
      const state = {
        timestamp: Date.now(),
        pwaStatus,
        performanceMetrics
      };
      
      try {
        sessionStorage.setItem('pwa_session_state', JSON.stringify(state));
      } catch (error) {
        console.warn('[PWA] Failed to save session state:', error);
      }
    });
  };
  
  // ==================== 推送通知 ====================
  
  const registerPushNotifications = async () => {
    try {
      if (!('Notification' in window) || !pwa.serviceWorker.registration) {
        return;
      }
      
      // 请求通知权限
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('[PWA] Notification permission granted');
        
        // 注册推送订阅（如果有推送服务）
        // const subscription = await pwa.serviceWorker.registration.pushManager.subscribe({
        //   userVisibleOnly: true,
        //   applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY'
        // });
      }
    } catch (error) {
      console.warn('[PWA] Failed to register push notifications:', error);
    }
  };
  
  // ==================== 性能监控 ====================
  
  const setupPerformanceMonitoring = () => {
    // 使用Performance Observer监控关键指标
    if ('PerformanceObserver' in window) {
      // 监控页面加载性能
      const perfObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            setPerformanceMetrics(prev => ({
              ...prev,
              loadTime: navEntry.loadEventEnd - navEntry.loadEventStart
            }));
          } else if (entry.entryType === 'paint') {
            if (entry.name === 'first-contentful-paint') {
              setPerformanceMetrics(prev => ({
                ...prev,
                firstContentfulPaint: entry.startTime
              }));
            }
          }
        });
      });
      
      try {
        perfObserver.observe({ entryTypes: ['navigation', 'paint'] });
      } catch (error) {
        console.warn('[PWA] Performance monitoring not available:', error);
      }
    }
    
    // 监控Core Web Vitals
    if ('web-vitals' in window) {
      // 这里可以集成web-vitals库
      console.log('[PWA] Core Web Vitals monitoring available');
    }
  };
  
  // ==================== 网络状态监听 ====================
  
  const setupNetworkListener = () => {
    const updateOnlineStatus = () => {
      const isOnline = navigator.onLine;
      setPwaStatus(prev => ({ ...prev, isOnline }));
      
      if (isOnline) {
        console.log('[PWA] Network connection restored');
        // 网络恢复时触发数据同步
        pwa.syncData().catch(console.warn);
      } else {
        console.log('[PWA] Network connection lost');
      }
    };
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  };
  
  // ==================== 状态更新 ====================
  
  useEffect(() => {
    setPwaStatus(prev => ({
      ...prev,
      hasUpdate: pwa.update.hasUpdate,
      isUpdating: pwa.update.isUpdating
    }));
  }, [pwa.update.hasUpdate, pwa.update.isUpdating]);
  
  // ==================== PWA状态指示器 ====================
  
  const PWAStatusIndicator: React.FC = () => {
    if (!showDebugInfo) return null;
    
    return (
      <div className="fixed top-16 right-4 bg-gray-900 text-white p-3 rounded-lg shadow-lg text-xs max-w-xs z-40">
        <div className="font-semibold mb-2">PWA 状态</div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>在线状态:</span>
            <span className={pwaStatus.isOnline ? 'text-green-400' : 'text-red-400'}>
              {pwaStatus.isOnline ? '在线' : '离线'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>已安装:</span>
            <span className={pwaStatus.isInstalled ? 'text-green-400' : 'text-yellow-400'}>
              {pwaStatus.isInstalled ? '是' : '否'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>SW状态:</span>
            <span className={pwa.serviceWorker.isRegistered ? 'text-green-400' : 'text-red-400'}>
              {pwa.serviceWorker.state || '未注册'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>有更新:</span>
            <span className={pwa.update.hasUpdate ? 'text-orange-400' : 'text-green-400'}>
              {pwa.update.hasUpdate ? '是' : '否'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>同步状态:</span>
            <span className={`text-${pwa.offline.syncStatus === 'success' ? 'green' : 
              pwa.offline.syncStatus === 'error' ? 'red' : 'yellow'}-400`}>
              {pwa.offline.syncStatus}
            </span>
          </div>
        </div>
        
        {/* 性能指标 */}
        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="font-semibold mb-1">性能指标</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>加载时间:</span>
              <span>{performanceMetrics.loadTime.toFixed(0)}ms</span>
            </div>
            <div className="flex justify-between">
              <span>FCP:</span>
              <span>{performanceMetrics.firstContentfulPaint.toFixed(0)}ms</span>
            </div>
          </div>
        </div>
        
        {/* 缓存信息 */}
        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="font-semibold mb-1">缓存状态</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>缓存项:</span>
              <span>{resourcePreloader.cacheInfo.itemCount}</span>
            </div>
            <div className="flex justify-between">
              <span>缓存大小:</span>
              <span>{(resourcePreloader.cacheInfo.totalSize / 1024).toFixed(0)}KB</span>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // ==================== 渲染 ====================
  
  return (
    <div className="pwa-wrapper">
      {/* 主要内容 */}
      {children}
      
      {/* PWA安装提示 */}
      {enableInstallPrompt && (
        <PWAInstallPrompt
          installInfo={pwa.install}
          onInstall={pwa.triggerInstall}
        />
      )}
      
      {/* PWA更新横幅 */}
      {enableUpdateBanner && (
        <PWAUpdateBanner
          updateInfo={pwa.update}
          serviceWorkerInfo={pwa.serviceWorker}
          onUpdate={pwa.applyUpdate}
          onCheckUpdate={pwa.checkForUpdate}
          onClearCache={pwa.clearCache}
        />
      )}
      
      {/* 离线状态提示 */}
      {pwa.offline.isOffline && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white p-2 text-center text-sm z-50">
          <span className="font-medium">离线模式</span>
          {pwa.offline.pendingSyncCount > 0 && (
            <span className="ml-2">
              有 {pwa.offline.pendingSyncCount} 条数据待同步
            </span>
          )}
        </div>
      )}
      
      {/* PWA状态指示器（开发模式） */}
      <PWAStatusIndicator />
      
      {/* 预加载进度指示器 */}
      {resourcePreloader.isPreloading && (
        <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-3 rounded-lg shadow-lg text-sm z-40">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>预加载资源中...</span>
          </div>
          {resourcePreloader.preloadResults.length > 0 && (
            <div className="mt-1 text-xs opacity-75">
              已完成: {resourcePreloader.preloadResults.filter(r => r.success).length} / {resourcePreloader.preloadResults.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PWAWrapper;