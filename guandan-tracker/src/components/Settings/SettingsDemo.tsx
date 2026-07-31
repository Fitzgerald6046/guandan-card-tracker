import React, { useState } from 'react';
import Settings from './Settings';
import type { SettingsSnapshot } from './Settings';

/**
 * Settings组件演示页面
 * 展示设置面板的各种功能和用法
 */
const SettingsDemo: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [settingsHistory, setSettingsHistory] = useState<Array<{
    timestamp: string;
    settings: SettingsSnapshot;
    action: string;
  }>>([]);

  const handleSettingsChange = (settings: SettingsSnapshot) => {
    console.log('设置已更新:', settings);
    
    // 记录设置变更历史
    const historyEntry = {
      timestamp: new Date().toLocaleString(),
      settings: settings,
      action: '设置更新'
    };
    
    setSettingsHistory(prev => [historyEntry, ...prev.slice(0, 4)]);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Settings 组件演示
          </h1>
          <p className="text-gray-600">
            完整的掼蛋游戏设置管理组件
          </p>
        </div>

        {/* 功能概览 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow border">
            <div className="text-2xl mb-3">🎮</div>
            <h3 className="font-semibold text-gray-900 mb-2">游戏设置</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 初始级数设置</li>
              <li>• 队伍分配调整</li>
              <li>• 游戏规则选项</li>
            </ul>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow border">
            <div className="text-2xl mb-3">🎨</div>
            <h3 className="font-semibold text-gray-900 mb-2">显示设置</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 主题切换</li>
              <li>• 卡牌大小调节</li>
              <li>• 动画开关</li>
            </ul>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow border">
            <div className="text-2xl mb-3">💾</div>
            <h3 className="font-semibold text-gray-900 mb-2">数据管理</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 导出游戏记录</li>
              <li>• 清除历史数据</li>
              <li>• 备份/恢复配置</li>
            </ul>
          </div>
        </div>

        {/* 演示控制 */}
        <div className="bg-white rounded-lg p-6 shadow border mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">演示控制</h2>
          
          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={() => setShowSettings(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              🔧 打开设置面板
            </button>
            
            <button
              onClick={() => setSettingsHistory([])}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200"
            >
              🗑️ 清除操作历史
            </button>
          </div>

          {/* 设置变更历史 */}
          {settingsHistory.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">设置变更历史</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {settingsHistory.map((entry, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 rounded-lg p-3 border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {entry.action}
                      </span>
                      <span className="text-xs text-gray-500">
                        {entry.timestamp}
                      </span>
                    </div>
                    <pre className="text-xs text-gray-600 bg-white p-2 rounded border overflow-x-auto">
                      {JSON.stringify(entry.settings, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 技术特性 */}
        <div className="bg-white rounded-lg p-6 shadow border mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">技术特性</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-3">🎯 核心功能</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>三大功能模块(游戏/显示/数据)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>选项卡式界面设计</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>实时设置同步</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>数据导出和备份</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>危险操作确认</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-3">🎨 设计特色</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 mt-0.5">●</span>
                  <span>响应式布局设计</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 mt-0.5">●</span>
                  <span>Tailwind CSS样式系统</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 mt-0.5">●</span>
                  <span>平滑过渡动画</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 mt-0.5">●</span>
                  <span>直观的开关控件</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 mt-0.5">●</span>
                  <span>清晰的视觉层次</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 使用示例 */}
        <div className="bg-white rounded-lg p-6 shadow border">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">使用示例</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">基础用法</h3>
              <pre className="bg-gray-50 rounded-lg p-4 text-sm overflow-x-auto">
{`import { Settings } from './components/Settings';

function App() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <Settings
      isOpen={showSettings}
      onClose={() => setShowSettings(false)}
      onSettingsChange={(settings) => {
        console.log('设置更新:', settings);
      }}
    />
  );
}`}
              </pre>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">与GameContext集成</h3>
              <pre className="bg-gray-50 rounded-lg p-4 text-sm overflow-x-auto">
{`import { useGame } from '../contexts/GameContext';

function GameApp() {
  const { state, actions } = useGame();
  
  return (
    <Settings
      isOpen={state.ui.showSettings}
      onClose={() => actions.toggleSettings(false)}
      onSettingsChange={(settings) => {
        actions.updatePreferences(settings.displaySettings);
      }}
    />
  );
}`}
              </pre>
            </div>
          </div>
        </div>

        {/* Settings组件 */}
        <Settings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onSettingsChange={handleSettingsChange}
        />
      </div>
    </div>
  );
};

export default SettingsDemo;
