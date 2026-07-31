import React, { useState, useMemo } from 'react';
import PlayerSelector from './PlayerSelector';
import type { Card, Player, GameRank, PlayerPosition, Suit, Team } from '../../types';
import { PlayerPosition as PlayerPositionEnum, Rank } from '../../types/game';

// 生成唯一ID
const generateId = (): string => {
  return `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// 生成随机卡牌数据（模拟）
const generateMockCards = (count: number, currentRank: GameRank): Card[] => {
  const cards: Card[] = [];
  for (let i = 0; i < count; i++) {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks: GameRank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    
    const suit = suits[Math.floor(Math.random() * suits.length)];
    const rank = ranks[Math.floor(Math.random() * ranks.length)];
    
    const isCurrentRankCard = rank === currentRank;
    const isWild = suit === 'hearts' && isCurrentRankCard;
    
    cards.push({
      id: generateId(),
      suit,
      rank,
      isRankCard: isCurrentRankCard,
      isWildCard: isWild,
      isPlayed: false,
      isSelected: false,
      timestamp: Date.now()
    });
  }
  return cards;
};

/**
 * PlayerSelector 组件演示页面
 * 展示队伍显示、统计信息和快速切换功能
 */
const PlayerSelectorDemo: React.FC = () => {
  const [currentRank, setCurrentRank] = useState<GameRank>(7);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [showDetailedStats, setShowDetailedStats] = useState(true);
  const [showTeamScores, setShowTeamScores] = useState(true);
  const [enableKeyboard, setEnableKeyboard] = useState(true);
  const [lastAction, setLastAction] = useState<string>('');

  // 创建模拟玩家数据
  const mockPlayers = useMemo((): Player[] => {
    const positions: PlayerPosition[] = ['bottom', 'left', 'top', 'right'];
    const teams: Team[] = [1, 2, 1, 2]; // 下上为1队，左右为2队
    const names = ['张三', '李四', '王五', '赵六'];

    return positions.map((position, index) => {
      const team = teams[index];
      const cardCount = Math.floor(Math.random() * 20) + 5; // 5-24张牌
      const playedCount = Math.floor(Math.random() * 10);
      const roundWins = Math.floor(Math.random() * 3);

      return {
        id: `player-${index + 1}`,
        name: names[index],
        position,
        team,
        cards: generateMockCards(cardCount, currentRank),
        remainingCount: cardCount,
        isCurrentPlayer: index === 0, // 默认第一个为当前玩家
        stats: {
          playedCards: playedCount,
          rankCardCount: Math.floor(Math.random() * 5),
          wildCardCount: Math.floor(Math.random() * 3),
          roundWins
        }
      };
    });
  }, [currentRank]);

  // 获取当前选中的玩家
  const currentPlayer = mockPlayers.find(p => p.id === selectedPlayerId);

  // 处理玩家选择
  const handlePlayerSelect = (player: Player) => {
    setSelectedPlayerId(player.id);
    setLastAction(`选择了玩家: ${player.name} (${getPositionName(player.position)})`);
  };

  // 处理队伍切换
  const handleTeamSwitch = (team: Team) => {
    setLastAction(`切换到队伍 ${team} (${team === 1 ? '上下队' : '左右队'})`);
  };

  // 处理键盘快捷键
  const handleKeyboardShortcut = (key: string, player?: Player) => {
    if (player) {
      setLastAction(`键盘快捷键 "${key}" - 选择了 ${player.name}`);
    } else {
      setLastAction(`键盘快捷键 "${key}" - 切换队友`);
    }
  };

  // 获取位置名称
  const getPositionName = (position: PlayerPosition): string => {
    const names = {
      [PlayerPositionEnum.BOTTOM]: '下方',
      [PlayerPositionEnum.TOP]: '上方',
      [PlayerPositionEnum.LEFT]: '左方',
      [PlayerPositionEnum.RIGHT]: '右方'
    };
    return names[position] || position;
  };

  // 获取级数显示名称
  const getRankDisplayName = (rank: GameRank): string => {
    if (rank === 11) return 'J';
    if (rank === 12) return 'Q';
    if (rank === 13) return 'K';
    if (rank === 14) return 'A';
    return rank.toString();
  };

  const rankOptions: GameRank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 头部控制区 */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            PlayerSelector 组件演示
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 级数选择 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                当前级数
              </label>
              <select
                value={currentRank}
                onChange={(e) => setCurrentRank(Number(e.target.value) as GameRank)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {rankOptions.map(rank => (
                  <option key={rank} value={rank}>
                    {getRankDisplayName(rank)}
                  </option>
                ))}
              </select>
            </div>

            {/* 显示选项 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                显示选项
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showDetailedStats}
                    onChange={(e) => setShowDetailedStats(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="ml-2 text-sm">详细统计</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showTeamScores}
                    onChange={(e) => setShowTeamScores(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="ml-2 text-sm">队伍总分</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={enableKeyboard}
                    onChange={(e) => setEnableKeyboard(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="ml-2 text-sm">键盘快捷键</span>
                </label>
              </div>
            </div>

            {/* 当前选择 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                当前选择
              </label>
              <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-800">
                  {currentPlayer ? currentPlayer.name : '无'}
                </div>
                <div className="text-xs text-blue-600">
                  {currentPlayer ? getPositionName(currentPlayer.position) : '请选择玩家'}
                </div>
              </div>
            </div>

            {/* 最后操作 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                最后操作
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-sm text-gray-700">
                  {lastAction || '暂无操作'}
                </div>
              </div>
            </div>
          </div>

          {/* 功能说明 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">功能说明</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div>
                <strong>队伍显示:</strong> 明确的队伍分组和颜色区分，显示队伍总分
              </div>
              <div>
                <strong>统计信息:</strong> 每个玩家的牌数、级牌、配牌、大小王统计
              </div>
              <div>
                <strong>快速切换:</strong> 支持点击选择、键盘快捷键（1-4）、左右箭头切换队友
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PlayerSelector 组件 */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <PlayerSelector
            players={mockPlayers}
            currentPlayer={currentPlayer}
            currentRank={currentRank}
            showDetailedStats={showDetailedStats}
            showTeamScores={showTeamScores}
            enableKeyboardShortcuts={enableKeyboard}
            onPlayerSelect={handlePlayerSelect}
            onTeamSwitch={handleTeamSwitch}
            onKeyboardShortcut={handleKeyboardShortcut}
          />
        </div>

        {/* 选中玩家详情 */}
        {currentPlayer && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 基本信息 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                玩家详情
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">姓名:</span>
                  <span className="font-medium">{currentPlayer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">位置:</span>
                  <span className="font-medium">{getPositionName(currentPlayer.position)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">队伍:</span>
                  <span className={`font-medium ${currentPlayer.team === 1 ? 'text-blue-600' : 'text-green-600'}`}>
                    {currentPlayer.team === 1 ? '上下队' : '左右队'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">手牌数:</span>
                  <span className="font-medium">{currentPlayer.cards.length} 张</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">胜利次数:</span>
                  <span className="font-medium">{currentPlayer.stats.roundWins} 次</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">是否当前玩家:</span>
                  <span className={`font-medium ${currentPlayer.isCurrentPlayer ? 'text-green-600' : 'text-gray-400'}`}>
                    {currentPlayer.isCurrentPlayer ? '是' : '否'}
                  </span>
                </div>
              </div>
            </div>

            {/* 卡牌统计 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                卡牌统计
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {currentPlayer.cards.filter(c => c.isWildCard).length}
                  </div>
                  <div className="text-sm text-red-500">配牌</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {currentPlayer.cards.filter(c => c.isRankCard && !c.isWildCard).length}
                  </div>
                  <div className="text-sm text-yellow-500">级牌</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {currentPlayer.cards.filter(c => c.rank === Rank.JOKER_BIG || c.rank === Rank.JOKER_SMALL).length}
                  </div>
                  <div className="text-sm text-purple-500">大小王</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">
                    {currentPlayer.cards.filter(c => !c.isRankCard && !c.isWildCard && c.rank !== Rank.JOKER_BIG && c.rank !== Rank.JOKER_SMALL).length}
                  </div>
                  <div className="text-sm text-gray-500">普通牌</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 页脚说明 */}
      <div className="bg-gray-800 text-white p-6 mt-12">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-lg font-semibold mb-4">操作指南</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-medium mb-2">鼠标操作:</h4>
              <ul className="space-y-1 text-gray-300">
                <li>• 点击玩家卡片: 选择该玩家</li>
                <li>• 点击队伍按钮: 切换队伍视图</li>
                <li>• 悬停效果: 高亮显示玩家信息</li>
                <li>• 前一个/后一个按钮: 切换队友</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">键盘快捷键:</h4>
              <ul className="space-y-1 text-gray-300">
                <li>• 数字键 1-4: 直接选择对应玩家</li>
                <li>• 左箭头 ←: 切换到前一个队友</li>
                <li>• 右箭头 →: 切换到后一个队友</li>
                <li>• 在输入框中不会触发快捷键</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerSelectorDemo;
