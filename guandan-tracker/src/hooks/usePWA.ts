/**
 * PWA功能管理Hook
 * 处理PWA安装、更新、离线状态等功能
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  BeforeInstallPromptEvent,
  NavigatorWithStandalone,
  ServiceWorkerRegistrationWithSync
} from '../types/pwa';

// ==================== 类型定义 ====================

interface PWAInstallPrompt {
  /** 是否显示安装提示 */
  showInstallPrompt: boolean;
  /** 平台类型 */
  platform: 'ios' | 'android' | 'desktop' | 'unsupported';
  /** 是否可以安装 */
  canInstall: boolean;
  /** 安装事件 */
  deferredPrompt: BeforeInstallPromptEvent | null;
}

interface PWAUpdateInfo {
  /** 是否有更新 */
  hasUpdate: boolean;
  /** 是否正在更新 */
  isUpdating: boolean;
  /** 更新错误 */
  updateError: string | null;
  /** 新版本信息 */
  newVersion?: string;
}

interface PWAOfflineInfo {
  /** 是否离线 */
  isOffline: boolean;
  /** 离线时间 */
  offlineTimestamp: number | null;
  /** 数据同步状态 */
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  /** 待同步数据数量 */
  pendingSyncCount: number;
}

interface ServiceWorkerInfo {
  /** SW是否已注册 */
  isRegistered: boolean;
  /** SW状态 */
  state: 'installing' | 'waiting' | 'active' | 'redundant' | 'activated' | 'activating' | 'installed' | null;
  /** 注册对象 */
  registration: ServiceWorkerRegistration | null;
}

interface UsePWAReturn {
  /** 安装相关 */
  install: PWAInstallPrompt;
  /** 更新相关 */
  update: PWAUpdateInfo;
  /** 离线相关 */
  offline: PWAOfflineInfo;
  /** Service Worker相关 */
  serviceWorker: ServiceWorkerInfo;
  
  /** 触发安装 */
  triggerInstall: () => Promise<boolean>;
  /** 检查更新 */
  checkForUpdate: () => Promise<void>;
  /** 应用更新 */
  applyUpdate: () => Promise<void>;
  /** 手动同步数据 */
  syncData: () => Promise<void>;
  /** 清理缓存 */
  clearCache: () => Promise<void>;
  /** 获取缓存信息 */
  getCacheInfo: () => Promise<Record<string, number>>;
}

// ==================== 工具函数 ====================

/**
 * 检测平台类型
 */
function detectPlatform(): PWAInstallPrompt['platform'] {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'ios';
  } else if (/android/.test(userAgent)) {
    return 'android';
  } else if ('serviceWorker' in navigator) {
    return 'desktop';
  } else {
    return 'unsupported';
  }
}

/**
 * 检查是否已安装为PWA
 */
function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as NavigatorWithStandalone).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

// ==================== Hook主函数 ====================

export function usePWA(): UsePWAReturn {
  // 安装相关状态
  const [install, setInstall] = useState<PWAInstallPrompt>({
    showInstallPrompt: false,
    platform: detectPlatform(),
    canInstall: false,
    deferredPrompt: null
  });
  
  // 更新相关状态
  const [update, setUpdate] = useState<PWAUpdateInfo>({
    hasUpdate: false,
    isUpdating: false,
    updateError: null
  });
  
  // 离线相关状态
  const [offline, setOffline] = useState<PWAOfflineInfo>({
    isOffline: !navigator.onLine,
    offlineTimestamp: null,
    syncStatus: 'idle',
    pendingSyncCount: 0
  });
  
  // Service Worker相关状态
  const [serviceWorker, setServiceWorker] = useState<ServiceWorkerInfo>({
    isRegistered: false,
    state: null,
    registration: null
  });
  
  // ==================== Service Worker 注册 ====================
  
  const trackServiceWorkerState = useCallback((worker: ServiceWorker) => {
    worker.addEventListener('statechange', () => {
      setServiceWorker(prev => ({ ...prev, state: worker.state }));
      
      if (worker.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          // 有新的SW等待激活
          setUpdate(prev => ({ ...prev, hasUpdate: true }));
        }
      }
    });
  }, []);
  
  const handleServiceWorkerMessage = useCallback((event: MessageEvent<{
    type: string;
    data: { failed: number; successful: number };
  }>) => {
    const { type, data } = event.data;
    
    switch (type) {
      case 'SW_ACTIVATED':
        console.log('Service Worker activated');
        break;
      case 'SYNC_COMPLETED':
        setOffline(prev => ({
          ...prev,
          syncStatus: data.failed > 0 ? 'error' : 'success',
          pendingSyncCount: Math.max(0, prev.pendingSyncCount - data.successful)
        }));
        break;
      case 'CACHE_INFO':
        // 处理缓存信息响应
        break;
    }
  }, []);

  const registerServiceWorker = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      setServiceWorker(prev => ({
        ...prev,
        isRegistered: true,
        registration,
        state: registration.active?.state || 'installing'
      }));

      if (registration.installing) {
        trackServiceWorkerState(registration.installing);
      } else if (registration.waiting) {
        setUpdate(prev => ({ ...prev, hasUpdate: true }));
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          trackServiceWorkerState(newWorker);
        }
      });

      navigator.serviceWorker.addEventListener(
        'message',
        handleServiceWorkerMessage
      );
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }, [handleServiceWorkerMessage, trackServiceWorkerState]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void registerServiceWorker();
    }
  }, [registerServiceWorker]);
  
  // ==================== 安装提示处理 ====================
  
  useEffect(() => {
    // 监听beforeinstallprompt事件
    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setInstall(prev => ({
        ...prev,
        showInstallPrompt: !isStandalone(),
        canInstall: true,
        deferredPrompt: promptEvent
      }));
    };
    
    // 监听appinstalled事件
    const handleAppInstalled = () => {
      setInstall(prev => ({
        ...prev,
        showInstallPrompt: false,
        canInstall: false,
        deferredPrompt: null
      }));
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);
  
  // ==================== 操作函数 ====================
  
  const triggerInstall = useCallback(async (): Promise<boolean> => {
    if (!install.deferredPrompt) {
      return false;
    }
    
    try {
      const promptEvent = install.deferredPrompt;
      promptEvent.prompt();
      
      const result = await promptEvent.userChoice;
      
      if (result.outcome === 'accepted') {
        setInstall(prev => ({
          ...prev,
          showInstallPrompt: false,
          canInstall: false,
          deferredPrompt: null
        }));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Install prompt failed:', error);
      return false;
    }
  }, [install.deferredPrompt]);
  
  const checkForUpdate = useCallback(async (): Promise<void> => {
    if (!serviceWorker.registration) {
      return;
    }
    
    try {
      await serviceWorker.registration.update();
    } catch (error) {
      console.error('Update check failed:', error);
      setUpdate(prev => ({
        ...prev,
        updateError: 'Failed to check for updates'
      }));
    }
  }, [serviceWorker.registration]);
  
  const applyUpdate = useCallback(async (): Promise<void> => {
    if (!serviceWorker.registration?.waiting) {
      return;
    }
    
    setUpdate(prev => ({ ...prev, isUpdating: true }));
    
    try {
      // 发送消息给waiting的SW，让其skipWaiting
      serviceWorker.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // 等待新SW激活
      await new Promise<void>((resolve) => {
        const handleControllerChange = () => {
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
          resolve();
        };
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      });
      
      setUpdate({
        hasUpdate: false,
        isUpdating: false,
        updateError: null
      });
      
      // 刷新页面以加载新版本
      window.location.reload();
      
    } catch (error) {
      console.error('Update apply failed:', error);
      setUpdate(prev => ({
        ...prev,
        isUpdating: false,
        updateError: 'Failed to apply update'
      }));
    }
  }, [serviceWorker.registration]);
  
  const syncData = useCallback(async (): Promise<void> => {
    if (!serviceWorker.registration || offline.isOffline) {
      return;
    }
    
    setOffline(prev => ({ ...prev, syncStatus: 'syncing' }));
    
    try {
      // 触发后台同步（如果支持）
      const syncManager = (
        serviceWorker.registration as ServiceWorkerRegistrationWithSync
      ).sync;
      if (syncManager) {
        await syncManager.register('game-data-sync');
      }
      
      // 模拟同步完成（实际由SW处理）
      setTimeout(() => {
        setOffline(prev => ({
          ...prev,
          syncStatus: 'success',
          pendingSyncCount: 0
        }));
      }, 2000);
      
    } catch (error) {
      console.error('Data sync failed:', error);
      setOffline(prev => ({ ...prev, syncStatus: 'error' }));
    }
  }, [serviceWorker.registration, offline.isOffline]);

  // ==================== 网络状态监听 ====================

  useEffect(() => {
    const handleOnline = () => {
      setOffline(prev => ({
        ...prev,
        isOffline: false,
        offlineTimestamp: null
      }));
      void syncData();
    };

    const handleOffline = () => {
      setOffline(prev => ({
        ...prev,
        isOffline: true,
        offlineTimestamp: Date.now()
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncData]);
  
  const clearCache = useCallback(async (): Promise<void> => {
    if (!serviceWorker.registration) {
      return;
    }
    
    try {
      // 发送清理缓存消息给SW
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_CACHE'
        });
      }
      
      // 清理本地存储
      localStorage.removeItem('pwa_offline_data');
      
    } catch (error) {
      console.error('Cache clear failed:', error);
    }
  }, [serviceWorker.registration]);
  
  const getCacheInfo = useCallback(async (): Promise<Record<string, number>> => {
    if (!serviceWorker.registration || !navigator.serviceWorker.controller) {
      return {};
    }
    
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_INFO') {
          resolve(event.data.data);
        }
      };
      
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(
          { type: 'GET_CACHE_INFO' },
          [channel.port2]
        );
      }
      
      // 超时处理
      setTimeout(() => resolve({}), 5000);
    });
  }, [serviceWorker.registration]);
  
  return {
    install,
    update,
    offline,
    serviceWorker,
    triggerInstall,
    checkForUpdate,
    applyUpdate,
    syncData,
    clearCache,
    getCacheInfo
  };
}

export default usePWA;
export type { UsePWAReturn, PWAInstallPrompt, PWAUpdateInfo, PWAOfflineInfo, ServiceWorkerInfo };
