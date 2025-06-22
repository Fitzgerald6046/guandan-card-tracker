import React, { useMemo, useState } from 'react';
import type { Player, GameRank, Card as CardType } from '../types';
import { countRankCards, isJoker } from '../utils/rankUtils';

interface GameStatsProps {
  /** 玩家列表 */
  players: Player[];
  /** 当前级数 */
  currentRank: GameRank;
  /** 是否显示详细模式 */
  detailed?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

interface PlayerStats {
  playerId: string;
  name: string;
  team: number;
  totalCards: number;
  remainingCards: number;
  playedCards: number;
  rankCards: number;
  wildCards: number;
  jokers: number;
  normalCards: number;
  powerLevel: number; // 实力评估
}

interface TeamStats {
  teamId: number;
  name: string;
  totalCards: number;
  remainingCards: number;
  rankCards: number;
  wildCards: number;
  jokers: number;
  advantage: number; // 优势值
  players: PlayerStats[];
}

interface GameAnalysis {
  totalCards: number;
  playedCards: number;
  remainingCards: number;
  gameProgress: number; // 游戏进度百分比
  teamBalance: number; // 队伍平衡度 (-1到1，0最平衡)
  expectedWinner: number | null; // 预测获胜队伍
  criticalCards: CardType[]; // 关键牌
  insights: string[]; // 洞察分析
}

const GameStats: React.FC<GameStatsProps> = ({
  players,
  currentRank,
  detailed = false,
  className = ''
}) => {
  const [viewMode, setViewMode] = useState<'overview' | 'teams' | 'analysis'>('overview');

  // 计算玩家统计
  const playerStats = useMemo((): PlayerStats[] => {
    return players.map(player => {
      const cardStats = countRankCards(player.cards, currentRank);
      const jokerCount = player.cards.filter(card => isJoker(card)).length;
      
      // 计算实力评估 (基于剩余牌的质量)
      const powerLevel = (
        cardStats.wildCards * 3 + // 配牌权重最高
        cardStats.rankCards * 2 + // 级牌权重中等
        jokerCount * 4 + // 大小王权重最高
        cardStats.normalCards * 1 // 普通牌权重最低
      ) / Math.max(player.remainingCount, 1);

      return {
        playerId: player.id,
        name: player.name,
        team: player.team,
        totalCards: player.cards.length,
        remainingCards: player.remainingCount,
        playedCards: player.cards.length - player.remainingCount,
        rankCards: cardStats.rankCards,
        wildCards: cardStats.wildCards,
        jokers: jokerCount,
        normalCards: cardStats.normalCards,
        powerLevel: Math.round(powerLevel * 100) / 100
      };
    });
  }, [players, currentRank]);

  // 计算队伍统计
  const teamStats = useMemo((): TeamStats[] => {
    const teams = [1, 2].map(teamId => {
      const teamPlayers = playerStats.filter(p => p.team === teamId);
      const totalCards = teamPlayers.reduce((sum, p) => sum + p.totalCards, 0);
      const remainingCards = teamPlayers.reduce((sum, p) => sum + p.remainingCards, 0);
      const rankCards = teamPlayers.reduce((sum, p) => sum + p.rankCards, 0);
      const wildCards = teamPlayers.reduce((sum, p) => sum + p.wildCards, 0);
      const jokers = teamPlayers.reduce((sum, p) => sum + p.jokers, 0);
      
      // 计算队伍优势值
      const advantage = wildCards * 3 + rankCards * 2 + jokers * 4;

      return {
        teamId,
        name: teamId === 1 ? '上下队' : '左右队',
        totalCards,
        remainingCards,
        rankCards,
        wildCards,
        jokers,
        advantage,
        players: teamPlayers
      };
    });

    return teams;
  }, [playerStats]);

  // 游戏分析
  const gameAnalysis = useMemo((): GameAnalysis => {
    const totalCards = playerStats.reduce((sum, p) => sum + p.totalCards, 0);
    const playedCards = playerStats.reduce((sum, p) => sum + p.playedCards, 0);
    const remainingCards = playerStats.reduce((sum, p) => sum + p.remainingCards, 0);
    const gameProgress = totalCards > 0 ? (playedCards / totalCards) * 100 : 0;

    // 计算队伍平衡度
    const team1Advantage = teamStats[0]?.advantage || 0;
    const team2Advantage = teamStats[1]?.advantage || 0;
    const totalAdvantage = team1Advantage + team2Advantage;
    const teamBalance = totalAdvantage > 0 
      ? (team1Advantage - team2Advantage) / totalAdvantage 
      : 0;

    // 预测获胜队伍
    let expectedWinner: number | null = null;
    if (Math.abs(teamBalance) > 0.2) {
      expectedWinner = teamBalance > 0 ? 1 : 2;
    }

    // 生成洞察分析
    const insights: string[] = [];
    
    if (gameProgress < 25) {
      insights.push('🎮 游戏刚开始，各队机会均等');
    } else if (gameProgress < 50) {
      insights.push('⚡ 游戏进入中期，策略变得关键');
    } else if (gameProgress < 75) {
      insights.push('🔥 游戏进入后期，每一步都很重要');
    } else {
      insights.push('🏁 游戏接近尾声，胜负即将揭晓');
    }

    if (Math.abs(teamBalance) > 0.3) {
      const leadingTeam = teamBalance > 0 ? '上下队' : '左右队';
      insights.push(`💪 ${leadingTeam}目前拥有明显优势`);
    } else if (Math.abs(teamBalance) < 0.1) {
      insights.push('⚖️ 两队实力非常均衡，胜负难料');
    }

    // 查找关键牌
    const allCards = players.flatMap(p => p.cards);
    const criticalCards = allCards.filter(card => 
      card.isWildCard || card.isRankCard || isJoker(card)
    );

    return {
      totalCards,
      playedCards,
      remainingCards,
      gameProgress: Math.round(gameProgress),
      teamBalance,
      expectedWinner,
      criticalCards,
      insights
    };
  }, [playerStats, teamStats, players]);

  // 获取实力等级显示
  const getPowerLevelDisplay = (level: number) => {
    if (level >= 3) return { text: '强势', color: 'text-red-600', bg: 'bg-red-100' };
    if (level >= 2) return { text: '良好', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    if (level >= 1) return { text: '一般', color: 'text-blue-600', bg: 'bg-blue-100' };
    return { text: '弱势', color: 'text-gray-600', bg: 'bg-gray-100' };
  };

  return (
    <div className={`card-enhanced glassmorphism ${className} fade-in`}>
      {/* 头部控制 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 text-shadow">📊 游戏统计</h3>
          
          {/* 视图模式切换 */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
            {[
              { id: 'overview', label: '总览', icon: '📈' },
              { id: 'teams', label: '队伍', icon: '👥' },
              { id: 'analysis', label: '分析', icon: '🔍' }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id as any)}
                className={`
                  px-3 py-1 text-xs font-medium rounded-lg transition-all duration-200
                  ${viewMode === mode.id
                    ? 'bg-white text-blue-700 shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                <span className="mr-1">{mode.icon}</span>
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* 游戏进度 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">🎯 游戏进度</span>
            <span className="text-sm font-bold text-blue-600">{gameAnalysis.gameProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-xl h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-xl transition-all duration-500"
              style={{ width: `${gameAnalysis.gameProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>已出: {gameAnalysis.playedCards}</span>
            <span>剩余: {gameAnalysis.remainingCards}</span>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-4">
        {/* 总览模式 */}
        {viewMode === 'overview' && (
          <div className="space-y-4">
            {/* 关键指标 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-blue-100 rounded-xl hover:bg-blue-200 transition-colors duration-200">
                <div className="text-lg font-bold text-blue-600">{gameAnalysis.remainingCards}</div>
                <div className="text-xs text-blue-500 font-medium">🃏 剩余牌数</div>
              </div>
              <div className="text-center p-3 bg-red-100 rounded-xl hover:bg-red-200 transition-colors duration-200">
                <div className="text-lg font-bold text-red-600">
                  {gameAnalysis.criticalCards.filter(c => c.isWildCard).length}
                </div>
                <div className="text-xs text-red-500 font-medium">🔥 配牌数量</div>
              </div>
              <div className="text-center p-3 bg-yellow-100 rounded-xl hover:bg-yellow-200 transition-colors duration-200">
                <div className="text-lg font-bold text-yellow-600">
                  {gameAnalysis.criticalCards.filter(c => c.isRankCard).length}
                </div>
                <div className="text-xs text-yellow-500 font-medium">⭐ 级牌数量</div>
              </div>
              <div className="text-center p-3 bg-purple-100 rounded-xl hover:bg-purple-200 transition-colors duration-200">
                <div className="text-lg font-bold text-purple-600">
                  {gameAnalysis.criticalCards.filter(c => isJoker(c)).length}
                </div>
                <div className="text-xs text-purple-500 font-medium">👑 大小王</div>
              </div>
            </div>

            {/* 玩家快速概览 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {playerStats.map((player, index) => {
                const powerDisplay = getPowerLevelDisplay(player.powerLevel);
                return (
                  <div 
                    key={player.playerId} 
                    className={`
                      p-3 rounded-xl border-l-4 transition-all duration-200 hover:shadow-md
                      ${player.team === 1 ? 'border-l-blue-500 bg-blue-50' : 'border-l-green-500 bg-green-50'}
                    `}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className={`
                          w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white
                          ${player.team === 1 ? 'bg-blue-500' : 'bg-green-500'}
                        `}>
                          {player.team}
                        </div>
                        <span className="font-medium text-gray-900">{player.name}</span>
                      </div>
                      <div className={`px-2 py-1 text-xs font-medium rounded-lg ${powerDisplay.bg} ${powerDisplay.color}`}>
                        {powerDisplay.text}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-bold text-gray-900">{player.remainingCards}</div>
                        <div className="text-gray-500">剩余</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-red-600">{player.wildCards}</div>
                        <div className="text-gray-500">配牌</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-purple-600">{player.jokers}</div>
                        <div className="text-gray-500">王牌</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 队伍模式 */}
        {viewMode === 'teams' && (
          <div className="space-y-4">
            {teamStats.map((team, index) => (
              <div 
                key={team.teamId} 
                className={`
                  card-enhanced p-4 border-l-4
                  ${team.teamId === 1 ? 'border-l-blue-500' : 'border-l-green-500'}
                `}
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className={`
                    text-lg font-semibold
                    ${team.teamId === 1 ? 'text-blue-600' : 'text-green-600'}
                  `}>
                    {team.teamId === 1 ? '🔵' : '🟢'} {team.name}
                  </h4>
                  <div className="text-sm text-gray-500">
                    优势值: <span className="font-bold">{team.advantage}</span>
                  </div>
                </div>

                {/* 队伍统计 */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="text-center p-2 bg-white rounded-lg shadow-soft">
                    <div className="text-lg font-bold text-gray-900">{team.remainingCards}</div>
                    <div className="text-xs text-gray-500">剩余牌</div>
                  </div>
                  <div className="text-center p-2 bg-red-100 rounded-lg">
                    <div className="text-lg font-bold text-red-600">{team.wildCards}</div>
                    <div className="text-xs text-red-500">配牌</div>
                  </div>
                  <div className="text-center p-2 bg-yellow-100 rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">{team.rankCards}</div>
                    <div className="text-xs text-yellow-500">级牌</div>
                  </div>
                  <div className="text-center p-2 bg-purple-100 rounded-lg">
                    <div className="text-lg font-bold text-purple-600">{team.jokers}</div>
                    <div className="text-xs text-purple-500">大小王</div>
                  </div>
                </div>

                {/* 队伍成员 */}
                <div className="space-y-2">
                  {team.players.map((player, playerIndex) => {
                    const powerDisplay = getPowerLevelDisplay(player.powerLevel);
                    return (
                      <div 
                        key={player.playerId}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{player.name}</span>
                          <div className={`px-2 py-1 text-xs font-medium rounded ${powerDisplay.bg} ${powerDisplay.color}`}>
                            {powerDisplay.text}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">
                          {player.remainingCards} 张 (实力: {player.powerLevel})
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分析模式 */}
        {viewMode === 'analysis' && (
          <div className="space-y-4">
            {/* 预测结果 */}
            {gameAnalysis.expectedWinner && (
              <div className={`
                p-4 rounded-xl border-2 
                ${gameAnalysis.expectedWinner === 1 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-green-400 bg-green-50'
                }
              `}>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-lg">🎯</span>
                  <span className="font-semibold text-gray-900">胜负预测</span>
                </div>
                <p className={`
                  font-medium
                  ${gameAnalysis.expectedWinner === 1 ? 'text-blue-700' : 'text-green-700'}
                `}>
                  {gameAnalysis.expectedWinner === 1 ? '上下队' : '左右队'} 拥有更大胜算
                </p>
              </div>
            )}

            {/* 洞察分析 */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">💡 战况分析</h4>
              {gameAnalysis.insights.map((insight, index) => (
                <div 
                  key={index}
                  className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <p className="text-sm text-gray-700">{insight}</p>
                </div>
              ))}
            </div>

            {/* 队伍平衡度 */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">⚖️ 队伍平衡度</h4>
              <div className="relative">
                <div className="w-full bg-gray-200 rounded-xl h-4">
                  <div 
                    className={`
                      h-4 rounded-xl transition-all duration-500
                      ${gameAnalysis.teamBalance > 0 
                        ? 'bg-gradient-to-r from-blue-400 to-blue-600' 
                        : 'bg-gradient-to-r from-green-400 to-green-600'
                      }
                    `}
                    style={{ 
                      width: `${Math.abs(gameAnalysis.teamBalance) * 50 + 50}%`,
                      transformOrigin: gameAnalysis.teamBalance > 0 ? 'left' : 'right'
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>🔵 上下队</span>
                  <span>平衡</span>
                  <span>左右队 🟢</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameStats; 