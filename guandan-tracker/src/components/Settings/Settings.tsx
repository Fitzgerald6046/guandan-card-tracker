import React, { useState, useCallback, useMemo } from 'react';
import type { GameRank, Team, PlayerPosition } from '../../types';
import { useGame } from '../../contexts/GameContext';

// 设置选项卡类型
type SettingsTab = 'game' | 'display' | 'data';

// 队伍分配选项
interface TeamAssignment {
  player1: { name: string; team: Team; position: PlayerPosition };
  player2: { name: string; team: Team; position: PlayerPosition };
  player3: { name: string; team: Team; position: PlayerPosition };
  player4: { name: string; team: Team; position: PlayerPosition };
}

// 游戏规则选项
interface GameRules {
  tributeEnabled: boolean;           // 贡牌规则
  doubleUpgrade: boolean;           // 双升规则
  jokerUpgrade: boolean;            // 大小王升级
  sameCardUpgrade: boolean;         // 同牌型升级
  maxRounds: number | null;         // 最大回合数
  timeLimit: number | null;         // 时间限制(分钟)
}

// 显示设置选项
interface DisplaySettings {
  theme: 'light' | 'dark' | 'auto';
  cardSize: 'small' | 'medium' | 'large';
  animationEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  autoSave: boolean;
  showCardCount: boolean;
  showPlayerStats: boolean;
  showTeamStats: boolean;
  compactMode: boolean;
  highContrast: boolean;
  revealedCardColor: 'yellow' | 'red' | 'blue' | 'green' | 'purple';
  playerColors: {
    bottom: string;
    left: string;
    top: string;
    right: string;
  };
}

// 数据管理选项
interface DataManagement {
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  maxBackups: number;
  exportFormat: 'json' | 'csv' | 'txt';
}

export interface SettingsSnapshot {
  initialRank: GameRank;
  teamAssignment: TeamAssignment;
  gameRules: GameRules;
  displaySettings: DisplaySettings;
  dataManagement: DataManagement;
}

interface SettingsProps {
  /** 是否显示设置面板 */
  isOpen: boolean;
  /** 关闭设置面板回调 */
  onClose: () => void;
  /** 设置变更回调 */
  onSettingsChange?: (settings: SettingsSnapshot) => void;
}

const Settings: React.FC<SettingsProps> = ({
  isOpen,
  onClose,
  onSettingsChange
}) => {
  const { state, actions } = useGame();
  const [activeTab, setActiveTab] = useState<SettingsTab>('game');
  const [isLoading, setIsLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // 游戏设置状态
  const [initialRank, setInitialRank] = useState<GameRank>(7);
  const [teamAssignment, setTeamAssignment] = useState<TeamAssignment>({
    player1: { name: '您', team: 1, position: 'bottom' },
    player2: { name: '左方玩家', team: 2, position: 'left' },
    player3: { name: '上方玩家', team: 1, position: 'top' },
    player4: { name: '右方玩家', team: 2, position: 'right' }
  });
  const [gameRules, setGameRules] = useState<GameRules>({
    tributeEnabled: false,
    doubleUpgrade: false,
    jokerUpgrade: false,
    sameCardUpgrade: false,
    maxRounds: null,
    timeLimit: null
  });

  // 显示设置状态
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({
    theme: 'auto',
    cardSize: 'medium',
    animationEnabled: true,
    soundEnabled: false,
    vibrationEnabled: false,
    autoSave: true,
    showCardCount: true,
    showPlayerStats: true,
    showTeamStats: true,
    compactMode: false,
    highContrast: false,
    revealedCardColor: 'yellow',
    playerColors: {
      bottom: '#3b82f6', // 蓝色
      left: '#10b981',   // 绿色
      top: '#f59e0b',    // 黄色
      right: '#ef4444'   // 红色
    }
  });

  // 数据管理状态
  const [dataManagement, setDataManagement] = useState<DataManagement>({
    autoBackup: true,
    backupFrequency: 'weekly',
    maxBackups: 5,
    exportFormat: 'json'
  });

  // 选项卡配置
  const tabs = useMemo(() => [
    {
      id: 'game' as const,
      label: '游戏设置',
      icon: '🎮',
      description: '级数、队伍分配、游戏规则'
    },
    {
      id: 'display' as const,
      label: '显示设置',
      icon: '🎨',
      description: '主题、卡牌大小、动画效果'
    },
    {
      id: 'data' as const,
      label: '数据管理',
      icon: '💾',
      description: '导出、备份、清除数据'
    }
  ], []);

  // 级数选项
  const rankOptions = useMemo(() => {
    const ranks: GameRank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    return ranks.map(rank => ({
      value: rank,
      label: rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : rank === 14 ? 'A' : rank.toString()
    }));
  }, []);

  // 位置选项
  const positionOptions = [
    { value: 'bottom' as PlayerPosition, label: '下方(您)', icon: '↓' },
    { value: 'left' as PlayerPosition, label: '左方', icon: '←' },
    { value: 'top' as PlayerPosition, label: '上方', icon: '↑' },
    { value: 'right' as PlayerPosition, label: '右方', icon: '→' }
  ];

  // 队伍选项
  const teamOptions = [
    { value: 1 as Team, label: '1队(上下)', color: 'text-blue-600' },
    { value: 2 as Team, label: '2队(左右)', color: 'text-green-600' }
  ];

  // 更新队伍分配
  const updateTeamAssignment = useCallback(<K extends keyof TeamAssignment['player1'],>(
    playerKey: keyof TeamAssignment,
    field: K,
    value: TeamAssignment['player1'][K]
  ) => {
    setTeamAssignment(prev => ({
      ...prev,
      [playerKey]: {
        ...prev[playerKey],
        [field]: value
      }
    }));
  }, []);

  // 更新游戏规则
  const updateGameRules = useCallback(<K extends keyof GameRules,>(
    field: K,
    value: GameRules[K]
  ) => {
    setGameRules(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // 更新显示设置
  const updateDisplaySettings = useCallback(<K extends keyof DisplaySettings,>(
    field: K,
    value: DisplaySettings[K]
  ) => {
    setDisplaySettings(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // 更新数据管理设置
  const updateDataManagement = useCallback(<K extends keyof DataManagement,>(
    field: K,
    value: DataManagement[K]
  ) => {
    setDataManagement(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // 导出游戏数据
  const exportGameData = useCallback(async () => {
    setIsLoading(true);
    try {
      const gameData = {
        gameState: state.gameState,
        settings: {
          game: gameRules,
          display: displaySettings,
          data: dataManagement
        },
        exportTime: new Date().toISOString()
      };

      let exportContent: string;
      let fileName: string;
      let mimeType: string;

      switch (dataManagement.exportFormat) {
        case 'json':
          exportContent = JSON.stringify(gameData, null, 2);
          fileName = `guandan-game-${Date.now()}.json`;
          mimeType = 'application/json';
          break;
        case 'csv':
          // 简化的CSV导出
          exportContent = [
            'Player,Team,Position,Cards,Remaining',
            ...gameData.gameState.players.map(p => 
              `${p.name},${p.team},${p.position},${p.cards.length},${p.remainingCount}`
            )
          ].join('\n');
          fileName = `guandan-game-${Date.now()}.csv`;
          mimeType = 'text/csv';
          break;
        case 'txt':
          exportContent = `掼蛋游戏记录\n导出时间: ${new Date().toLocaleString()}\n\n` +
            gameData.gameState.players.map(p => 
              `${p.name} (${p.team}队 ${p.position}): ${p.remainingCount}/${p.cards.length}`
            ).join('\n');
          fileName = `guandan-game-${Date.now()}.txt`;
          mimeType = 'text/plain';
          break;
        default:
          throw new Error('不支持的导出格式');
      }

      // 创建下载链接
      const blob = new Blob([exportContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('导出失败:', error);
      actions.setError('导出失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsLoading(false);
    }
  }, [state.gameState, gameRules, displaySettings, dataManagement, actions]);

  // 清除历史数据
  const clearHistoryData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 清除localStorage中的数据
      localStorage.removeItem('guandan-game-history');
      localStorage.removeItem('guandan-player-stats');
      localStorage.removeItem('guandan-settings-backup');
      
      actions.setError(null);
      alert('历史数据已清除');
    } catch (error) {
      console.error('清除数据失败:', error);
      actions.setError('清除数据失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsLoading(false);
      setShowResetConfirm(false);
    }
  }, [actions]);

  // 重置所有设置
  const resetAllSettings = useCallback(() => {
    setInitialRank(7);
    setTeamAssignment({
      player1: { name: '您', team: 1, position: 'bottom' },
      player2: { name: '左方玩家', team: 2, position: 'left' },
      player3: { name: '上方玩家', team: 1, position: 'top' },
      player4: { name: '右方玩家', team: 2, position: 'right' }
    });
    setGameRules({
      tributeEnabled: false,
      doubleUpgrade: false,
      jokerUpgrade: false,
      sameCardUpgrade: false,
      maxRounds: null,
      timeLimit: null
    });
    setDisplaySettings({
      theme: 'auto',
      cardSize: 'medium',
      animationEnabled: true,
      soundEnabled: false,
      vibrationEnabled: false,
      autoSave: true,
      showCardCount: true,
      showPlayerStats: true,
      showTeamStats: true,
      compactMode: false,
      highContrast: false,
      revealedCardColor: 'yellow',
      playerColors: {
        bottom: '#3b82f6', // 蓝色
        left: '#10b981',   // 绿色
        top: '#f59e0b',    // 黄色
        right: '#ef4444'   // 红色
      }
    });
    setDataManagement({
      autoBackup: true,
      backupFrequency: 'weekly',
      maxBackups: 5,
      exportFormat: 'json'
    });
  }, []);

  // 应用设置
  const applySettings = useCallback(() => {
    try {
      // 更新上下文中的设置
      actions.updatePreferences({
        enableKeyboardShortcuts: true,
        showDetailedStats: displaySettings.showPlayerStats,
        showTeamScores: displaySettings.showTeamStats,
        autoSaveEnabled: displaySettings.autoSave,
        theme: displaySettings.theme
      });

      // 保存到localStorage
      localStorage.setItem('guandan-settings', JSON.stringify({
        initialRank,
        teamAssignment,
        gameRules,
        displaySettings,
        dataManagement
      }));

      onSettingsChange?.({
        initialRank,
        teamAssignment,
        gameRules,
        displaySettings,
        dataManagement
      });

      onClose();
    } catch (error) {
      console.error('应用设置失败:', error);
      actions.setError('应用设置失败');
    }
  }, [
    initialRank, teamAssignment, gameRules, displaySettings, dataManagement,
    actions, onSettingsChange, onClose
  ]);

  // 如果不显示，返回null
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-md flex items-center justify-center p-4 z-50 fade-in">
      <div className="card-enhanced glassmorphism w-full max-w-4xl max-h-[90vh] overflow-hidden bounce">
        {/* 头部 */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 text-shadow">⚙️ 设置</h2>
            <button
              onClick={onClose}
              className="btn-icon text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          {/* 选项卡导航 */}
          <div className="mt-6 flex space-x-1 bg-gray-100 p-1 rounded-xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-sm font-medium 
                  transition-all duration-300 ease-in-out
                  ${activeTab === tab.id
                    ? 'bg-white text-blue-700 shadow-md scale-105'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] custom-scrollbar">
          {/* 游戏设置选项卡 */}
          {activeTab === 'game' && (
            <div className="space-y-8 fade-in">
              {/* 初始级数设置 */}
              <section className="card-enhanced glassmorphism p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-shadow">🎯 初始级数设置</h3>
                <div className="grid grid-cols-6 gap-3">
                  {rankOptions.map((rank, index) => (
                    <button
                      key={rank.value}
                      onClick={() => setInitialRank(rank.value)}
                      className={`
                        p-3 rounded-xl border text-center font-medium 
                        transition-all duration-300 ease-in-out transform hover:scale-105 active:scale-95
                        ${initialRank === rank.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md ring-2 ring-blue-400 ring-offset-2'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-soft'
                        }
                      `}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {rank.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-sm text-gray-500 font-medium">
                  💡 选择游戏开始时的级数，默认为7
                </p>
              </section>

              {/* 队伍分配调整 */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">队伍分配调整</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(teamAssignment).map(([playerKey, player]) => (
                    <div key={playerKey} className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-3">
                        玩家 {playerKey.slice(-1)}
                      </h4>
                      
                      {/* 玩家名称 */}
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          名称
                        </label>
                        <input
                          type="text"
                          value={player.name}
                          onChange={(e) => updateTeamAssignment(playerKey as keyof TeamAssignment, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* 队伍选择 */}
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          队伍
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {teamOptions.map((team) => (
                            <button
                              key={team.value}
                              onClick={() => updateTeamAssignment(playerKey as keyof TeamAssignment, 'team', team.value)}
                              className={`
                                p-2 rounded-lg border text-sm transition-colors duration-200
                                ${player.team === team.value
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                }
                              `}
                            >
                              {team.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 位置选择 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          位置
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {positionOptions.map((position) => (
                            <button
                              key={position.value}
                              onClick={() => updateTeamAssignment(playerKey as keyof TeamAssignment, 'position', position.value)}
                              className={`
                                p-2 rounded-lg border text-sm transition-colors duration-200 flex items-center justify-center space-x-1
                                ${player.position === position.value
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                }
                              `}
                            >
                              <span>{position.icon}</span>
                              <span>{position.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 游戏规则选项 */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">游戏规则选项</h3>
                <div className="space-y-4">
                  {/* 开关类规则 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'tributeEnabled', label: '贡牌规则', description: '输家向赢家贡牌' },
                      { key: 'doubleUpgrade', label: '双升规则', description: '连续获胜可以跳级' },
                      { key: 'jokerUpgrade', label: '大小王升级', description: '出完大小王可以升级' },
                      { key: 'sameCardUpgrade', label: '同牌型升级', description: '相同牌型连续出完升级' }
                    ].map((rule) => (
                      <div key={rule.key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">{rule.label}</div>
                          <div className="text-sm text-gray-500">{rule.description}</div>
                        </div>
                        <button
                          onClick={() => updateGameRules(rule.key as keyof GameRules, !gameRules[rule.key as keyof GameRules])}
                          className={`
                            relative w-12 h-6 rounded-full transition-colors duration-200
                            ${gameRules[rule.key as keyof GameRules] ? 'bg-blue-600' : 'bg-gray-300'}
                          `}
                        >
                          <div className={`
                            absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200
                            ${gameRules[rule.key as keyof GameRules] ? 'translate-x-6' : 'translate-x-0.5'}
                          `} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* 数值类规则 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 border border-gray-200 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        最大回合数
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={gameRules.maxRounds || ''}
                        onChange={(e) => updateGameRules('maxRounds', e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="无限制"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="p-3 border border-gray-200 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        时间限制(分钟)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={gameRules.timeLimit || ''}
                        onChange={(e) => updateGameRules('timeLimit', e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="无限制"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* 显示设置选项卡 */}
          {activeTab === 'display' && (
            <div className="space-y-8">
              {/* 主题设置 */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">主题设置</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: 'light', label: '浅色主题', icon: '☀️' },
                    { value: 'dark', label: '深色主题', icon: '🌙' },
                    { value: 'auto', label: '跟随系统', icon: '🔄' }
                  ].map((theme) => (
                    <button
                      key={theme.value}
                      onClick={() => updateDisplaySettings('theme', theme.value)}
                      className={`
                        p-4 rounded-lg border text-center transition-colors duration-200
                        ${displaySettings.theme === theme.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className="text-2xl mb-2">{theme.icon}</div>
                      <div className="font-medium">{theme.label}</div>
                    </button>
                  ))}
                </div>
              </section>

              {/* 卡牌大小调节 */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">卡牌大小</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: 'small', label: '小', description: '适合小屏幕' },
                    { value: 'medium', label: '中', description: '默认大小' },
                    { value: 'large', label: '大', description: '适合大屏幕' }
                  ].map((size) => (
                    <button
                      key={size.value}
                      onClick={() => updateDisplaySettings('cardSize', size.value)}
                      className={`
                        p-4 rounded-lg border text-center transition-colors duration-200
                        ${displaySettings.cardSize === size.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className="font-medium text-lg mb-1">{size.label}</div>
                      <div className="text-sm text-gray-500">{size.description}</div>
                    </button>
                  ))}
                </div>
              </section>

              {/* 明牌颜色设置 */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">明牌标记颜色</h3>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { value: 'yellow', label: '黄色', color: 'bg-yellow-400', ring: 'ring-yellow-400', description: '默认' },
                    { value: 'red', label: '红色', color: 'bg-red-400', ring: 'ring-red-400', description: '醒目' },
                    { value: 'blue', label: '蓝色', color: 'bg-blue-400', ring: 'ring-blue-400', description: '清新' },
                    { value: 'green', label: '绿色', color: 'bg-green-400', ring: 'ring-green-400', description: '护眼' },
                    { value: 'purple', label: '紫色', color: 'bg-purple-400', ring: 'ring-purple-400', description: '优雅' }
                  ].map((colorOption) => (
                    <button
                      key={colorOption.value}
                      onClick={() => updateDisplaySettings('revealedCardColor', colorOption.value)}
                      className={`
                        p-3 rounded-lg border text-center transition-all duration-200 transform hover:scale-105
                        ${displaySettings.revealedCardColor === colorOption.value
                          ? `border-gray-400 bg-gray-50 shadow-md ${colorOption.ring} ring-2 ring-offset-2`
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className={`w-8 h-8 ${colorOption.color} rounded-full mx-auto mb-2 shadow-sm`}></div>
                      <div className="font-medium text-sm">{colorOption.label}</div>
                      <div className="text-xs text-gray-500">{colorOption.description}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-sm text-gray-500">
                  💡 选择明牌标记的颜色，影响手牌输入和游戏中的明牌显示
                </div>
              </section>

              {/* 玩家颜色设置 */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">玩家颜色设置</h3>
                <div className="space-y-4">
                  {[
                    { key: 'bottom', label: '自己 (下家)', icon: '👤' },
                    { key: 'left', label: '对手一 (左家)', icon: '👥' },
                    { key: 'top', label: '队友 (上家)', icon: '👫' },
                    { key: 'right', label: '对手二 (右家)', icon: '👬' }
                  ].map((player) => (
                    <div key={player.key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{player.icon}</span>
                        <div>
                          <div className="font-medium text-gray-900">{player.label}</div>
                          <div className="text-sm text-gray-500">玩家标识颜色</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-8 h-8 rounded-full border-2 border-gray-300 shadow-sm"
                          style={{ backgroundColor: displaySettings.playerColors[player.key as keyof typeof displaySettings.playerColors] }}
                        ></div>
                        <input
                          type="color"
                          value={displaySettings.playerColors[player.key as keyof typeof displaySettings.playerColors]}
                          onChange={(e) => updateDisplaySettings('playerColors', {
                            ...displaySettings.playerColors,
                            [player.key]: e.target.value
                          })}
                          className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                          title={`选择${player.label}的颜色`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-sm text-gray-500">
                  💡 为每个玩家设置不同的标识颜色，便于在游戏中区分
                </div>
              </section>

              {/* 功能开关 */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">功能开关</h3>
                <div className="space-y-4">
                  {[
                    { key: 'animationEnabled', label: '动画效果', description: '启用界面动画和过渡效果' },
                    { key: 'soundEnabled', label: '音效', description: '启用操作音效' },
                    { key: 'vibrationEnabled', label: '震动反馈', description: '启用触摸震动反馈' },
                    { key: 'autoSave', label: '自动保存', description: '自动保存游戏进度' },
                    { key: 'showCardCount', label: '显示牌数', description: '显示剩余牌数' },
                    { key: 'showPlayerStats', label: '显示玩家统计', description: '显示详细的玩家统计信息' },
                    { key: 'showTeamStats', label: '显示队伍统计', description: '显示队伍总分和统计' },
                    { key: 'compactMode', label: '紧凑模式', description: '减少界面间距，适合小屏幕' },
                    { key: 'highContrast', label: '高对比度', description: '提高界面对比度，便于阅读' }
                  ].map((setting) => (
                    <div key={setting.key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">{setting.label}</div>
                        <div className="text-sm text-gray-500">{setting.description}</div>
                      </div>
                      <button
                        onClick={() => updateDisplaySettings(setting.key as keyof DisplaySettings, !displaySettings[setting.key as keyof DisplaySettings])}
                        className={`
                          relative w-12 h-6 rounded-full transition-colors duration-200
                          ${displaySettings[setting.key as keyof DisplaySettings] ? 'bg-blue-600' : 'bg-gray-300'}
                        `}
                      >
                        <div className={`
                          absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200
                          ${displaySettings[setting.key as keyof DisplaySettings] ? 'translate-x-6' : 'translate-x-0.5'}
                        `} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* 数据管理选项卡 */}
          {activeTab === 'data' && (
            <div className="space-y-8">
              {/* 导出游戏记录 */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">导出游戏记录</h3>
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      导出格式
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'json', label: 'JSON', description: '完整数据' },
                        { value: 'csv', label: 'CSV', description: '表格格式' },
                        { value: 'txt', label: 'TXT', description: '纯文本' }
                      ].map((format) => (
                        <button
                          key={format.value}
                          onClick={() => updateDataManagement('exportFormat', format.value)}
                          className={`
                            p-3 rounded-lg border text-center transition-colors duration-200
                            ${dataManagement.exportFormat === format.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }
                          `}
                        >
                          <div className="font-medium">{format.label}</div>
                          <div className="text-xs text-gray-500">{format.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={exportGameData}
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {isLoading ? '导出中...' : '📥 导出当前游戏数据'}
                  </button>
                </div>
              </section>

              {/* 备份设置 */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">自动备份设置</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">启用自动备份</div>
                      <div className="text-sm text-gray-500">定期备份游戏数据到本地存储</div>
                    </div>
                    <button
                      onClick={() => updateDataManagement('autoBackup', !dataManagement.autoBackup)}
                      className={`
                        relative w-12 h-6 rounded-full transition-colors duration-200
                        ${dataManagement.autoBackup ? 'bg-blue-600' : 'bg-gray-300'}
                      `}
                    >
                      <div className={`
                        absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200
                        ${dataManagement.autoBackup ? 'translate-x-6' : 'translate-x-0.5'}
                      `} />
                    </button>
                  </div>

                  {dataManagement.autoBackup && (
                    <>
                      <div className="p-3 border border-gray-200 rounded-lg">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          备份频率
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: 'daily', label: '每日' },
                            { value: 'weekly', label: '每周' },
                            { value: 'monthly', label: '每月' }
                          ].map((freq) => (
                            <button
                              key={freq.value}
                              onClick={() => updateDataManagement('backupFrequency', freq.value)}
                              className={`
                                p-2 rounded-lg border text-sm transition-colors duration-200
                                ${dataManagement.backupFrequency === freq.value
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                }
                              `}
                            >
                              {freq.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 border border-gray-200 rounded-lg">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          最大备份数量
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={dataManagement.maxBackups}
                          onChange={(e) => updateDataManagement('maxBackups', parseInt(e.target.value) || 5)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* 数据清理 */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">数据清理</h3>
                <div className="space-y-4">
                  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <h4 className="font-medium text-red-800 mb-2">⚠️ 危险操作</h4>
                    <p className="text-sm text-red-700 mb-4">
                      以下操作将永久删除数据，请谨慎操作。建议在执行前先导出备份。
                    </p>
                    
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowResetConfirm(true)}
                        className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors duration-200"
                      >
                        🗑️ 清除所有历史数据
                      </button>
                      
                      <button
                        onClick={resetAllSettings}
                        className="w-full bg-yellow-600 text-white py-2 px-4 rounded-lg hover:bg-yellow-700 transition-colors duration-200"
                      >
                        🔄 重置所有设置
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {tabs.find(tab => tab.id === activeTab)?.description}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                取消
              </button>
              <button
                onClick={applySettings}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                应用设置
              </button>
            </div>
          </div>
        </div>

        {/* 确认对话框 */}
        {showResetConfirm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">确认清除数据</h3>
              <p className="text-gray-600 mb-4">
                此操作将清除所有历史游戏记录和统计数据，且无法恢复。确定要继续吗？
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  取消
                </button>
                <button
                  onClick={clearHistoryData}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors duration-200"
                >
                  {isLoading ? '清除中...' : '确认清除'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
