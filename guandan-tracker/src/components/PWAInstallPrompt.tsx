/**
 * PWA安装提示组件
 * 为iOS和Android提供定制化的安装引导
 */

import React, { useState, useEffect } from 'react';
import type { PWAInstallPrompt } from '../hooks/usePWA';

// ==================== 类型定义 ====================

interface PWAInstallPromptProps {
  /** 安装信息 */
  installInfo: PWAInstallPrompt;
  /** 触发安装函数 */
  onInstall: () => Promise<boolean>;
  /** 关闭提示函数 */
  onClose?: () => void;
  /** 是否自动显示 */
  autoShow?: boolean;
}

interface InstallStep {
  icon: string;
  title: string;
  description: string;
}

// ==================== 安装步骤配置 ====================

const IOS_INSTALL_STEPS: InstallStep[] = [
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

const ANDROID_INSTALL_STEPS: InstallStep[] = [
  {
    icon: '📱',
    title: '点击菜单按钮',
    description: '在Chrome浏览器右上角找到三个点的菜单'
  },
  {
    icon: '⬇️',
    title: '选择"安装应用"',
    description: '在菜单中找到"安装应用"或"添加到主屏幕"'
  },
  {
    icon: '✅',
    title: '确认安装',
    description: '点击"安装"完成应用安装'
  }
];

const DESKTOP_INSTALL_STEPS: InstallStep[] = [
  {
    icon: '💻',
    title: '查看地址栏',
    description: '在浏览器地址栏右侧找到安装图标'
  },
  {
    icon: '⬇️',
    title: '点击安装',
    description: '点击安装图标或允许安装提示'
  },
  {
    icon: '✅',
    title: '完成安装',
    description: '应用将添加到您的应用程序中'
  }
];

// ==================== 组件定义 ====================

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  installInfo,
  onInstall,
  onClose,
  autoShow = true
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showDetailedSteps, setShowDetailedSteps] = useState(false);
  const [hasBeenDismissed, setHasBeenDismissed] = useState(false);
  
  // 检查是否已经被用户关闭过
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    setHasBeenDismissed(dismissed === 'true');
  }, []);
  
  // 控制提示显示
  useEffect(() => {
    if (autoShow && installInfo.showInstallPrompt && !hasBeenDismissed) {
      // 延迟显示，避免干扰用户初始体验
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [autoShow, installInfo.showInstallPrompt, hasBeenDismissed]);
  
  // 获取当前平台的安装步骤
  const getInstallSteps = (): InstallStep[] => {
    switch (installInfo.platform) {
      case 'ios':
        return IOS_INSTALL_STEPS;
      case 'android':
        return ANDROID_INSTALL_STEPS;
      case 'desktop':
        return DESKTOP_INSTALL_STEPS;
      default:
        return [];
    }
  };
  
  // 获取平台特定的信息
  const getPlatformInfo = () => {
    switch (installInfo.platform) {
      case 'ios':
        return {
          name: 'iOS设备',
          browser: 'Safari浏览器',
          icon: '🍎',
          canUseNativePrompt: false
        };
      case 'android':
        return {
          name: 'Android设备',
          browser: 'Chrome浏览器',
          icon: '🤖',
          canUseNativePrompt: installInfo.canInstall
        };
      case 'desktop':
        return {
          name: '桌面设备',
          browser: '支持的浏览器',
          icon: '💻',
          canUseNativePrompt: installInfo.canInstall
        };
      default:
        return {
          name: '当前设备',
          browser: '浏览器',
          icon: '📱',
          canUseNativePrompt: false
        };
    }
  };
  
  const platformInfo = getPlatformInfo();
  const installSteps = getInstallSteps();
  
  // 处理安装
  const handleInstall = async () => {
    if (platformInfo.canUseNativePrompt) {
      setIsInstalling(true);
      try {
        const success = await onInstall();
        if (success) {
          setIsVisible(false);
        }
      } catch (error) {
        console.error('Installation failed:', error);
      } finally {
        setIsInstalling(false);
      }
    } else {
      // 对于不支持原生安装的平台，显示详细步骤
      setShowDetailedSteps(true);
    }
  };
  
  // 处理关闭
  const handleClose = () => {
    setIsVisible(false);
    setHasBeenDismissed(true);
    localStorage.setItem('pwa_install_dismissed', 'true');
    onClose?.();
  };
  
  // 处理稍后提醒
  const handleRemindLater = () => {
    setIsVisible(false);
    // 24小时后再次提醒
    const remindTime = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem('pwa_install_remind_time', remindTime.toString());
  };
  
  if (!isVisible || installInfo.platform === 'unsupported') {
    return null;
  }
  
  return (
    <>
      {/* 主要安装提示 */}
      {!showDetailedSteps && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50 animate-slide-up">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">{platformInfo.icon}</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">
                安装掼蛋记牌器
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                安装到{platformInfo.name}，享受更好的使用体验
              </p>
              
              {/* 功能亮点 */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="flex items-center text-xs text-gray-500">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                  离线访问
                </div>
                <div className="flex items-center text-xs text-gray-500">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                  快速启动
                </div>
                <div className="flex items-center text-xs text-gray-500">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                  全屏体验
                </div>
                <div className="flex items-center text-xs text-gray-500">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                  推送通知
                </div>
              </div>
              
              {/* 操作按钮 */}
              <div className="flex space-x-2">
                <button
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {isInstalling ? '安装中...' : platformInfo.canUseNativePrompt ? '立即安装' : '查看步骤'}
                </button>
                <button
                  onClick={handleRemindLater}
                  className="px-3 py-2 text-gray-500 text-sm hover:text-gray-700 transition-colors"
                >
                  稍后
                </button>
              </div>
            </div>
            
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* 详细安装步骤 */}
      {showDetailedSteps && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-full overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  安装到{platformInfo.name}
                </h2>
                <button
                  onClick={() => setShowDetailedSteps(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  请在{platformInfo.browser}中按照以下步骤操作：
                </p>
              </div>
              
              {/* 安装步骤 */}
              <div className="space-y-4">
                {installSteps.map((step, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-lg">{step.icon}</span>
                        <h3 className="font-medium text-gray-800">{step.title}</h3>
                      </div>
                      <p className="text-sm text-gray-600">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* iOS特殊提示 */}
              {installInfo.platform === 'ios' && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <span className="text-yellow-600">⚠️</span>
                    <div className="text-sm">
                      <p className="text-yellow-800 font-medium mb-1">重要提示：</p>
                      <p className="text-yellow-700">
                        请确保使用Safari浏览器，在其他浏览器中无法安装PWA应用。
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* 安装后的好处 */}
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">安装后您将获得：</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                    独立应用图标，无需打开浏览器
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                    离线使用，无网络也能记牌
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                    更快的启动速度和流畅体验
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                    全屏显示，更大的可视区域
                  </li>
                </ul>
              </div>
              
              {/* 底部按钮 */}
              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => setShowDetailedSteps(false)}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  我知道了
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  不再提醒
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAInstallPrompt;

// 添加动画样式
const styles = `
@keyframes slide-up {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}
`;