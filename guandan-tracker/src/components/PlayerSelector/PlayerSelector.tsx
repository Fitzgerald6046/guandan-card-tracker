import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { Player, GameRank, PlayerPosition, Team } from '../../types';
import { PlayerPosition as PlayerPositionEnum } from '../../types/game';
import { countRankCards, isJoker } from '../../utils/rankUtils';

// 队伍信息接口
interface TeamInfo {
  id: Team;
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  players: Player[];
  totalScore: number;
}

interface PlayerSelectorProps {
  /** 玩家列表 */
  players: Player[];
  /** 当前选中的玩家 */
  currentPlayer?: Player;
  /** 当前级数 */
  currentRank: GameRank;
  /** 是否显示详细统计 */
  showDetailedStats?: boolean;
  /** 是否显示队伍总分 */
  showTeamScores?: boolean;
  /** 是否允许键盘快捷键 */
  enableKeyboardShortcuts?: boolean;
  /** 自定义样式类名 */
  className?: string;
  /** 玩家选择事件 */
  onPlayerSelect?: (player: Player) => void;
  /** 队伍切换事件 */
  onTeamSwitch?: (team: Team) => void;
  /** 键盘快捷键事件 */
  onKeyboardShortcut?: (key: string, player?: Player) => void;
}

const PlayerSelector: React.FC<PlayerSelectorProps> = ({
  players,
  currentPlayer,
  currentRank,
  showDetailedStats = true,
  showTeamScores = true,
  enableKeyboardShortcuts = true,
  className = '',
  onPlayerSelect,
  onTeamSwitch,
  onKeyboardShortcut
}) => {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);

  // 计算队伍信息
  const teamInfo = useMemo((): TeamInfo[] => {
    const team1Players = players.filter(p => p.team === 1);
    const team2Players = players.filter(p => p.team === 2);

    const team1Score = team1Players.reduce((sum, p) => sum + p.stats.roundWins, 0);
    const team2Score = team2Players.reduce((sum, p) => sum + p.stats.roundWins, 0);

    return [
      {
        id: 1,
        name: '上下队',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        players: team1Players,
        totalScore: team1Score
      },
      {
        id: 2,
        name: '左右队',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        players: team2Players,
        totalScore: team2Score
      }
    ];
  }, [players]);

  // 计算玩家统计信息
  const getPlayerStats = useCallback((player: Player) => {
    const cardStats = countRankCards(player.cards, currentRank);
    const jokerCount = player.cards.filter(card => isJoker(card)).length;
    
    return {
      totalCards: player.cards.length,
      rankCards: cardStats.rankCards,
      wildCards: cardStats.wildCards,
      jokers: jokerCount,
      normalCards: cardStats.normalCards,
      playedCards: player.stats.playedCards,
      remainingCount: player.remainingCount
    };
  }, [currentRank]);

  // 获取玩家位置显示名称
  const getPositionName = (position: PlayerPosition): string => {
    const names = {
      [PlayerPositionEnum.BOTTOM]: '下',
      [PlayerPositionEnum.TOP]: '上',
      [PlayerPositionEnum.LEFT]: '左',
      [PlayerPositionEnum.RIGHT]: '右'
    };
    return names[position] || position;
  };

  // 获取玩家位置图标
  const getPositionIcon = (position: PlayerPosition): string => {
    const icons = {
      [PlayerPositionEnum.BOTTOM]: '↓',
      [PlayerPositionEnum.TOP]: '↑',
      [PlayerPositionEnum.LEFT]: '←',
      [PlayerPositionEnum.RIGHT]: '→'
    };
    return icons[position] || '●';
  };

  // 处理玩家点击
  const handlePlayerClick = useCallback((player: Player) => {
    onPlayerSelect?.(player);
  }, [onPlayerSelect]);

  // 处理队伍切换
  const handleTeamSwitch = useCallback((team: Team) => {
    setSelectedTeam(selectedTeam === team ? null : team);
    onTeamSwitch?.(team);
  }, [selectedTeam, onTeamSwitch]);

  // 滑动切换队友
  const switchToTeammate = useCallback((direction: 'prev' | 'next') => {
    if (!currentPlayer) return;

    const teammates = players.filter(p => p.team === currentPlayer.team);
    const currentIndex = teammates.findIndex(p => p.id === currentPlayer.id);
    
    if (currentIndex === -1) return;

    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % teammates.length;
    } else {
      nextIndex = (currentIndex - 1 + teammates.length) % teammates.length;
    }

    const nextPlayer = teammates[nextIndex];
    if (nextPlayer) {
      onPlayerSelect?.(nextPlayer);
    }
  }, [currentPlayer, players, onPlayerSelect]);

  // 键盘快捷键处理
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 阻止在输入框中触发
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = event.key;

      // 1-4 数字键选择玩家
      if (['1', '2', '3', '4'].includes(key)) {
        event.preventDefault();
        const playerIndex = parseInt(key) - 1;
        const targetPlayer = players[playerIndex];
        if (targetPlayer) {
          onPlayerSelect?.(targetPlayer);
          onKeyboardShortcut?.(key, targetPlayer);
        }
        return;
      }

      // 左右箭头切换队友
      if (key === 'ArrowLeft') {
        event.preventDefault();
        switchToTeammate('prev');
        onKeyboardShortcut?.(key);
      } else if (key === 'ArrowRight') {
        event.preventDefault();
        switchToTeammate('next');
        onKeyboardShortcut?.(key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, players, switchToTeammate, onPlayerSelect, onKeyboardShortcut]);

  // 获取玩家样式
  const getPlayerStyles = (player: Player, isSelected: boolean, isHovered: boolean) => {
    if (isSelected) {
      return player.team === 1 
        ? 'player-card active team-1' 
        : 'player-card active team-2';
    }
    if (isHovered) {
      return player.team === 1 
        ? 'player-card team-1 hover:shadow-xl' 
        : 'player-card team-2 hover:shadow-xl';
    }
    return player.team === 1 
      ? 'player-card team-1' 
      : 'player-card team-2';
  };

  return (
    <div className={`card-enhanced glassmorphism ${className} fade-in`}>
      {/* 头部 - 队伍总览 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 text-shadow">👥 玩家选择</h3>
          
          {enableKeyboardShortcuts && (
            <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-lg font-medium">
              ⌨️ 快捷键: 1-4选择玩家, ←→切换队友
            </div>
          )}
        </div>

        {/* 队伍比分 */}
        {showTeamScores && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            {teamInfo.map((team, index) => (
              <React.Fragment key={team.id}>
                <button
                  onClick={() => handleTeamSwitch(team.id)}
                  className={`
                    p-3 rounded-xl border-2 transition-all duration-300 ease-in-out
                    ${team.borderColor} ${team.bgColor}
                    ${selectedTeam === team.id ? 'ring-2 ring-offset-2 ring-blue-400 scale-105' : ''}
                    hover:shadow-lg hover:-translate-y-1 active:scale-95
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                  `}
                >
                  <div className={`text-sm font-medium ${team.color}`}>🏆 {team.name}</div>
                  <div className={`text-2xl font-bold ${team.color}`}>{team.totalScore}</div>
                  <div className="text-xs text-gray-500">👥 {team.players.length} 人</div>
                </button>
                
                {index === 0 && (
                  <div className="flex items-center justify-center">
                    <div className="text-2xl font-bold text-gray-400 pulse">⚔️</div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* 玩家列表 */}
      <div className="p-4">
        {teamInfo.map((team, teamIndex) => (
          <div key={team.id} className="mb-6 last:mb-0 fade-in" style={{ animationDelay: `${teamIndex * 150}ms` }}>
            {/* 队伍标题 */}
            <div className={`
              flex items-center justify-between p-3 rounded-t-xl border-b
              ${team.bgColor} ${team.borderColor} shadow-soft
            `}>
              <h4 className={`font-semibold ${team.color} text-shadow`}>
                {team.id === 1 ? '🔵' : '🟢'} {team.name}
              </h4>
              <div className="text-sm text-gray-500 font-medium">
                👥 {team.players.length} 名玩家
              </div>
            </div>

            {/* 队伍玩家 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-b-xl">
              {team.players.map((player, index) => {
                const isSelected = currentPlayer?.id === player.id;
                const isHovered = hoveredPlayer === player.id;
                const stats = getPlayerStats(player);

                return (
                  <div
                    key={player.id}
                    onClick={() => handlePlayerClick(player)}
                    onMouseEnter={() => setHoveredPlayer(player.id)}
                    onMouseLeave={() => setHoveredPlayer(null)}
                    className={`
                      ${getPlayerStyles(player, isSelected, isHovered)}
                      cursor-pointer fade-in
                      ${player.isCurrentPlayer ? 'shadow-strong' : ''}
                    `}
                    style={{ animationDelay: `${(teamIndex * 150) + (index * 100)}ms` }}
                  >
                    {/* 玩家基本信息 */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {/* 位置图标 */}
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-md
                          transition-all duration-200 ease-in-out
                          ${team.id === 1 ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'}
                          ${isSelected ? 'scale-110 bounce' : 'hover:scale-105'}
                        `}>
                          {getPositionIcon(player.position)}
                        </div>
                        
                        {/* 玩家名称 */}
                        <div>
                          <div className="font-semibold text-gray-900 text-shadow">{player.name}</div>
                          <div className="text-xs text-gray-500 font-medium">
                            📍 {getPositionName(player.position)}位
                          </div>
                        </div>
                        
                        {/* 键盘快捷键提示 */}
                        {enableKeyboardShortcuts && (
                          <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-lg font-bold">
                            {index + 1 + (team.id - 1) * 2}
                          </div>
                        )}
                      </div>

                      {/* 当前玩家标识 */}
                      {player.isCurrentPlayer && (
                        <div className="flex items-center space-x-1 bg-red-100 px-2 py-1 rounded-xl">
                          <div className="w-2 h-2 bg-red-500 rounded-full pulse"></div>
                          <span className="text-xs text-red-600 font-bold">✨ 当前</span>
                        </div>
                      )}
                    </div>

                    {/* 牌数统计 */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="text-center p-3 bg-white rounded-xl shadow-soft hover:shadow-md transition-shadow duration-200">
                        <div className="text-xl font-bold text-gray-900">{stats.totalCards}</div>
                        <div className="text-xs text-gray-500 font-medium">🃏 总牌数</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-xl shadow-soft hover:shadow-md transition-shadow duration-200">
                        <div className="text-xl font-bold text-blue-600">{stats.remainingCount}</div>
                        <div className="text-xs text-blue-500 font-medium">📦 剩余</div>
                      </div>
                    </div>

                    {/* 详细统计信息 */}
                    {showDetailedStats && (
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div className="flex justify-between bg-white p-2 rounded-lg shadow-soft hover:bg-red-50 transition-colors duration-200">
                          <span className="text-red-600 font-medium">🔥 配牌:</span>
                          <span className="font-bold text-red-700">{stats.wildCards}</span>
                        </div>
                        <div className="flex justify-between bg-white p-2 rounded-lg shadow-soft hover:bg-yellow-50 transition-colors duration-200">
                          <span className="text-yellow-600 font-medium">⭐ 级牌:</span>
                          <span className="font-bold text-yellow-700">{stats.rankCards}</span>
                        </div>
                        <div className="flex justify-between bg-white p-2 rounded-lg shadow-soft hover:bg-purple-50 transition-colors duration-200">
                          <span className="text-purple-600 font-medium">👑 大小王:</span>
                          <span className="font-bold text-purple-700">{stats.jokers}</span>
                        </div>
                        <div className="flex justify-between bg-white p-2 rounded-lg shadow-soft hover:bg-gray-50 transition-colors duration-200">
                          <span className="text-gray-600 font-medium">🃏 普通:</span>
                          <span className="font-bold text-gray-700">{stats.normalCards}</span>
                        </div>
                      </div>
                    )}

                    {/* 胜利次数 */}
                    {player.stats.roundWins > 0 && (
                      <div className="text-center">
                        <div className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-xl font-medium shadow-soft bounce">
                          <span className="mr-1">🏆</span>
                          {player.stats.roundWins} 胜
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* 空状态 */}
        {players.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 fade-in">
            <svg className="w-16 h-16 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <p className="text-lg font-medium text-gray-600">👥 暂无玩家</p>
            <p className="text-sm text-gray-500">请添加玩家开始游戏</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerSelector;