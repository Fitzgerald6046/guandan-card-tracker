/**
 * PWA更新横幅组件
 * 显示应用更新提醒和自定义安装横幅
 */

import React, { useState, useEffect } from 'react';
import type { PWAUpdateInfo, ServiceWorkerInfo } from '../hooks/usePWA';

// ==================== 类型定义 ====================

interface PWAUpdateBannerProps {
  /** 更新信息 */
  updateInfo: PWAUpdateInfo;
  /** Service Worker信息 */
  serviceWorkerInfo: ServiceWorkerInfo;
  /** 应用更新函数 */
  onUpdate: () => Promise<void>;
  /** 检查更新函数 */
  onCheckUpdate: () => Promise<void>;
  /** 清理缓存函数 */
  onClearCache: () => Promise<void>;
}

interface BannerState {
  type: 'update' | 'installing' | 'error' | 'success' | null;
  message: string;
  isVisible: boolean;
  autoHide: boolean;
}

// ==================== 组件定义 ====================

export const PWAUpdateBanner: React.FC<PWAUpdateBannerProps> = ({
  updateInfo,
  serviceWorkerInfo,
  onUpdate,
  onCheckUpdate,
  onClearCache
}) => {
  const [bannerState, setBannerState] = useState<BannerState>({
    type: null,
    message: '',
    isVisible: false,
    autoHide: false
  });
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);
  
  // 监听更新状态变化
  useEffect(() => {
    if (updateInfo.hasUpdate && !updateInfo.isUpdating) {
      showBanner('update', '发现新版本！点击更新以获得最新功能', false);
    } else if (updateInfo.isUpdating) {
      showBanner('installing', '正在更新应用，请稍候...', false);
    } else if (updateInfo.updateError) {
      showBanner('error', `更新失败：${updateInfo.updateError}`, true);
    }
  }, [updateInfo]);
  
  // 监听Service Worker状态
  useEffect(() => {
    if (serviceWorkerInfo.state === 'installing') {
      showBanner('installing', '正在安装应用更新...', false);
    } else if (serviceWorkerInfo.state === 'redundant') {
      showBanner('error', '应用更新失败，请刷新页面重试', true);
    }
  }, [serviceWorkerInfo.state]);
  
  // 自动检查更新
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const now = Date.now();
      // 每30分钟检查一次更新
      if (now - lastCheckTime > 30 * 60 * 1000) {
        onCheckUpdate();
        setLastCheckTime(now);
      }
    }, 5 * 60 * 1000); // 每5分钟检查一次间隔
    
    return () => clearInterval(checkInterval);
  }, [lastCheckTime, onCheckUpdate]);
  
  // 显示横幅
  const showBanner = (type: BannerState['type'], message: string, autoHide: boolean) => {
    setBannerState({
      type,
      message,
      isVisible: true,
      autoHide
    });
    
    if (autoHide) {
      setTimeout(() => {
        setBannerState(prev => ({ ...prev, isVisible: false }));
      }, 5000);
    }
  };
  
  // 隐藏横幅
  const hideBanner = () => {
    setBannerState(prev => ({ ...prev, isVisible: false }));
  };
  
  // 处理更新
  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await onUpdate();
      showBanner('success', '更新完成！应用将自动重启', true);
    } catch (error) {
      showBanner('error', '更新失败，请重试', true);
    } finally {
      setIsUpdating(false);
    }
  };
  
  // 处理手动检查更新
  const handleCheckUpdate = async () => {
    try {
      await onCheckUpdate();
      setLastCheckTime(Date.now());
      
      if (!updateInfo.hasUpdate) {
        showBanner('success', '您已使用最新版本', true);
      }
    } catch (error) {
      showBanner('error', '检查更新失败', true);
    }
  };
  
  // 处理清理缓存
  const handleClearCache = async () => {
    try {
      await onClearCache();
      showBanner('success', '缓存已清理，建议刷新页面', true);
    } catch (error) {
      showBanner('error', '清理缓存失败', true);
    }
  };
  
  // 获取横幅样式
  const getBannerStyles = () => {
    const baseStyles = 'fixed top-0 left-0 right-0 z-50 p-4 transform transition-transform duration-300';
    
    if (!bannerState.isVisible) {
      return `${baseStyles} -translate-y-full`;
    }
    
    switch (bannerState.type) {
      case 'update':
        return `${baseStyles} bg-blue-500 text-white translate-y-0`;
      case 'installing':
        return `${baseStyles} bg-yellow-500 text-white translate-y-0`;
      case 'error':
        return `${baseStyles} bg-red-500 text-white translate-y-0`;
      case 'success':
        return `${baseStyles} bg-green-500 text-white translate-y-0`;
      default:
        return `${baseStyles} -translate-y-full`;
    }
  };
  
  // 获取图标
  const getBannerIcon = () => {
    switch (bannerState.type) {
      case 'update':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
        );
      case 'installing':
        return (
          <svg className="w-5 h-5 animate-spin" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'success':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };
  
  return (
    <>
      {/* 更新横幅 */}
      <div className={getBannerStyles()}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getBannerIcon()}
            <span className="font-medium">{bannerState.message}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            {bannerState.type === 'update' && (
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isUpdating ? '更新中...' : '立即更新'}
              </button>
            )}
            
            {bannerState.type === 'error' && (
              <button
                onClick={handleCheckUpdate}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-1 rounded text-sm font-medium transition-colors"
              >
                重试
              </button>
            )}
            
            {!bannerState.autoHide && (
              <button
                onClick={hideBanner}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 p-1 rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* 开发者工具面板（仅在开发环境显示） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 bg-gray-800 text-white p-3 rounded-lg shadow-lg text-xs max-w-xs">
          <div className="font-semibold mb-2">PWA 开发工具</div>
          <div className="space-y-1 mb-3">
            <div>SW状态: {serviceWorkerInfo.state || '未注册'}</div>
            <div>已注册: {serviceWorkerInfo.isRegistered ? '是' : '否'}</div>
            <div>有更新: {updateInfo.hasUpdate ? '是' : '否'}</div>
            <div>更新中: {updateInfo.isUpdating ? '是' : '否'}</div>
          </div>
          <div className="space-y-1">
            <button
              onClick={handleCheckUpdate}
              className="block w-full bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs transition-colors"
            >
              检查更新
            </button>
            <button
              onClick={handleClearCache}
              className="block w-full bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs transition-colors"
            >
              清理缓存
            </button>
            <button
              onClick={() => showBanner('update', '测试更新横幅', false)}
              className="block w-full bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-xs transition-colors"
            >
              测试横幅
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAUpdateBanner;