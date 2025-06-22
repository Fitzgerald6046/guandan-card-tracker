# 高级功能模块使用文档

完整的掼蛋记牌器高级功能模块，包含级牌分析、游戏统计、历史记录管理等功能。

## 📁 模块结构

```
src/
├── hooks/
│   ├── useRankLogic.ts       # 级牌控制力分析Hook
│   ├── useGameHistory.ts     # 游戏历史记录Hook
│   └── useGameState.ts       # 基础游戏状态Hook
├── utils/
│   └── gameAnalytics.ts      # 游戏分析工具函数
└── components/
    ├── GameReplay.tsx        # 游戏回放组件
    └── DataExport.tsx        # 数据导出组件
```

## 🎯 核心功能

### 1. 级牌控制力分析 (useRankLogic.ts)

#### 主要功能
- ✅ **级牌控制力计算** - 分析各队伍对级牌的控制程度
- ✅ **配牌分布分析** - 评估配牌集中度和垄断情况
- ✅ **战术建议生成** - 基于牌力分析提供策略建议
- ✅ **关键牌识别** - 识别王牌、炸弹潜力等关键因素

#### 使用示例

```typescript
import { useRankLogic } from '../hooks/useRankLogic';
import { useGameState } from '../hooks/useGameState';

function AnalysisComponent() {
  const gameState = useGameState();
  const rankLogic = useRankLogic(gameState);
  
  const {
    rankControl,        // 级牌控制力分析
    wildCardDistribution, // 配牌分布
    tacticalAdvice,     // 战术建议
    keyCards,           // 关键牌分析
    getTeamAdvantageScore, // 队伍优势评分
    getBestPlayAdvice   // 出牌建议
  } = rankLogic;
  
  return (
    <div>
      <h2>队伍优势分析</h2>
      <p>队伍1优势评分: {getTeamAdvantageScore(1)}</p>
      <p>队伍2优势评分: {getTeamAdvantageScore(2)}</p>
      
      <h3>战术建议</h3>
      {tacticalAdvice.map((advice, index) => (
        <div key={index}>
          <h4>{advice.title}</h4>
          <p>{advice.description}</p>
          <ul>
            {advice.keyActions.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

#### 数据结构

```typescript
// 级牌控制力分析结果
interface RankControlAnalysis {
  totalRankCards: number;     // 总级牌数
  totalWildCards: number;     // 总配牌数
  teamControl: Record<Team, {
    rankCards: number;        // 队伍级牌数
    wildCards: number;        // 队伍配牌数
    controlRatio: number;     // 控制力比例
    advantage: number;        // 优势评分
  }>;
  dominantTeam: Team | null;  // 优势队伍
  controlGap: number;         // 控制力差距
}

// 战术建议
interface TacticalAdvice {
  type: 'offensive' | 'defensive' | 'balanced' | 'desperate';
  title: string;              // 建议标题
  description: string;        // 详细描述
  priority: number;           // 优先级 (1-5)
  targetTeam: Team;          // 目标队伍
  keyActions: string[];       // 关键行动
}
```

### 2. 游戏分析工具 (gameAnalytics.ts)

#### 主要功能
- ✅ **关键牌分布计算** - 分析配牌、级牌、王牌分布
- ✅ **牌型可能性分析** - 评估炸弹、顺子等牌型概率
- ✅ **出牌概率预测** - 预测各玩家出牌倾向
- ✅ **游戏报告生成** - 生成完整的游戏分析报告

#### 使用示例

```typescript
import { 
  generateGameReport, 
  calculateWinProbability,
  analyzeCriticalCards 
} from '../utils/gameAnalytics';

function GameAnalysis({ cards, cardOwnership, currentRank, gameStats }) {
  // 生成游戏报告
  const report = generateGameReport(cards, cardOwnership, currentRank, gameStats);
  
  // 计算胜率
  const team1WinProb = calculateWinProbability(cards, cardOwnership, currentRank, 1);
  const team2WinProb = calculateWinProbability(cards, cardOwnership, currentRank, 2);
  
  // 分析关键牌
  const criticalCards = analyzeCriticalCards(cards, cardOwnership, currentRank);
  
  return (
    <div>
      <h2>游戏分析报告</h2>
      <p>游戏阶段: {report.overallAssessment.gamePhase}</p>
      <p>风险等级: {report.overallAssessment.riskLevel}</p>
      
      <h3>胜率预测</h3>
      <p>队伍1: {(team1WinProb * 100).toFixed(1)}%</p>
      <p>队伍2: {(team2WinProb * 100).toFixed(1)}%</p>
      
      <h3>关键牌</h3>
      {criticalCards.map((card, index) => (
        <div key={index}>
          <p>{card.description} - 重要性: {card.importance}/10</p>
        </div>
      ))}
    </div>
  );
}
```

### 3. 历史记录管理 (useGameHistory.ts)

#### 主要功能
- ✅ **游戏记录保存** - 自动保存最近10局游戏
- ✅ **历史统计分析** - 计算胜率、趋势等统计信息
- ✅ **回放功能** - 支持游戏回放查看
- ✅ **数据导入导出** - 支持JSON、CSV格式导出

#### 使用示例

```typescript
import { useGameHistory } from '../hooks/useGameHistory';

function HistoryComponent() {
  const {
    gameRecords,        // 游戏记录列表
    statistics,         // 历史统计
    replayState,        // 回放状态
    saveCurrentGame,    // 保存当前游戏
    startReplay,        // 开始回放
    exportData,         // 导出数据
    getRecentGames      // 获取最近游戏
  } = useGameHistory();
  
  // 保存游戏
  const handleSaveGame = () => {
    saveCurrentGame(
      cards, 
      cardOwnership, 
      currentRank, 
      players, 
      gameStats,
      {
        isCompleted: true,
        winningTeam: 1,
        notes: '精彩的一局',
        tags: ['配牌优势', '完美配合']
      }
    );
  };
  
  // 导出数据
  const handleExport = () => {
    const data = exportData({
      format: 'json',
      includeData: {
        gameRecords: true,
        analysisReports: true,
        statistics: true,
        cardData: false
      }
    });
    console.log('导出的数据:', data);
  };
  
  return (
    <div>
      <h2>游戏历史</h2>
      <p>总游戏数: {statistics.totalGames}</p>
      <p>胜率: {(statistics.winRates.overall * 100).toFixed(1)}%</p>
      <p>最常用级数: {statistics.mostPlayedRank}</p>
      
      <h3>最近游戏</h3>
      {getRecentGames(5).map(game => (
        <div key={game.id}>
          <p>级数: {game.currentRank}, 时长: {Math.floor(game.duration/60)}分钟</p>
          <button onClick={() => startReplay(game.id)}>
            回放
          </button>
        </div>
      ))}
      
      <button onClick={handleSaveGame}>保存当前游戏</button>
      <button onClick={handleExport}>导出数据</button>
    </div>
  );
}
```

### 4. 游戏回放组件 (GameReplay.tsx)

#### 主要功能
- ✅ **回放控制** - 播放、暂停、进度控制
- ✅ **速度调节** - 0.25x到4x回放速度
- ✅ **状态展示** - 显示每个回放帧的游戏状态
- ✅ **分析展示** - 显示游戏分析和关键时刻

#### 使用示例

```typescript
import GameReplay from '../components/GameReplay';
import { useGameHistory } from '../hooks/useGameHistory';

function ReplayPage() {
  const { 
    loadGameRecord, 
    replayState,
    setReplayProgress,
    setReplaySpeed,
    startReplay,
    stopReplay 
  } = useGameHistory();
  
  const gameRecord = loadGameRecord('game_123');
  
  if (!gameRecord) {
    return <div>游戏记录不存在</div>;
  }
  
  return (
    <GameReplay
      gameRecord={gameRecord}
      replayState={replayState}
      onReplayControl={{
        setProgress: setReplayProgress,
        setSpeed: setReplaySpeed,
        start: () => startReplay(gameRecord.id),
        stop: stopReplay
      }}
    />
  );
}
```

### 5. 数据导出组件 (DataExport.tsx)

#### 主要功能
- ✅ **多格式导出** - JSON、CSV、TXT格式
- ✅ **过滤选项** - 按日期、级数过滤
- ✅ **预览功能** - 导出前预览数据规模
- ✅ **导入功能** - 支持数据导入和合并

#### 使用示例

```typescript
import DataExport from '../components/DataExport';
import { useGameHistory } from '../hooks/useGameHistory';

function ExportPage() {
  const { exportData, importData, gameRecords } = useGameHistory();
  
  const availableRanks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  
  return (
    <DataExport
      onExport={exportData}
      onImport={importData}
      availableRanks={availableRanks}
      totalGames={gameRecords.length}
    />
  );
}
```

## 🚀 完整集成示例

```typescript
import React from 'react';
import { useGameState } from '../hooks/useGameState';
import { useRankLogic } from '../hooks/useRankLogic';
import { useGameHistory } from '../hooks/useGameHistory';
import GameReplay from '../components/GameReplay';
import DataExport from '../components/DataExport';

function AdvancedGuandanTracker() {
  // 基础游戏状态
  const gameState = useGameState(5);
  
  // 级牌分析
  const rankLogic = useRankLogic(gameState);
  
  // 历史记录
  const history = useGameHistory();
  
  const [currentView, setCurrentView] = React.useState<'game' | 'analysis' | 'history' | 'export'>('game');
  
  return (
    <div className="advanced-tracker">
      {/* 导航菜单 */}
      <nav className="mb-6">
        <button 
          onClick={() => setCurrentView('game')}
          className={`mr-4 px-4 py-2 rounded ${currentView === 'game' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          游戏模式
        </button>
        <button 
          onClick={() => setCurrentView('analysis')}
          className={`mr-4 px-4 py-2 rounded ${currentView === 'analysis' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          分析模式
        </button>
        <button 
          onClick={() => setCurrentView('history')}
          className={`mr-4 px-4 py-2 rounded ${currentView === 'history' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          历史记录
        </button>
        <button 
          onClick={() => setCurrentView('export')}
          className={`px-4 py-2 rounded ${currentView === 'export' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          数据管理
        </button>
      </nav>
      
      {/* 内容区域 */}
      {currentView === 'game' && (
        <div>
          <h2>游戏模式</h2>
          {/* 基础游戏界面 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 游戏状态 */}
            <div>
              <h3>游戏状态</h3>
              <p>当前级数: {gameState.gameInfo.currentRankName}</p>
              <p>总卡牌: {gameState.cards.length}</p>
              <p>已分配: {gameState.gameInfo.totalAssignedCards}</p>
            </div>
            
            {/* 即时分析 */}
            <div>
              <h3>即时分析</h3>
              <p>配牌总数: {rankLogic.wildCardDistribution.total}</p>
              <p>优势队伍: {rankLogic.rankControl.dominantTeam ? `队伍${rankLogic.rankControl.dominantTeam}` : '势均力敌'}</p>
              {rankLogic.tacticalAdvice.slice(0, 2).map((advice, index) => (
                <div key={index} className="mt-2 p-2 bg-yellow-50 rounded">
                  <strong>{advice.title}</strong>
                  <p className="text-sm">{advice.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {currentView === 'analysis' && (
        <div>
          <h2>分析模式</h2>
          <div className="space-y-6">
            {/* 级牌控制力 */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h3>级牌控制力分析</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4>队伍1</h4>
                  <p>级牌: {rankLogic.rankControl.teamControl[1].rankCards}</p>
                  <p>配牌: {rankLogic.rankControl.teamControl[1].wildCards}</p>
                  <p>优势: {rankLogic.rankControl.teamControl[1].advantage}</p>
                </div>
                <div>
                  <h4>队伍2</h4>
                  <p>级牌: {rankLogic.rankControl.teamControl[2].rankCards}</p>
                  <p>配牌: {rankLogic.rankControl.teamControl[2].wildCards}</p>
                  <p>优势: {rankLogic.rankControl.teamControl[2].advantage}</p>
                </div>
              </div>
            </div>
            
            {/* 战术建议 */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h3>战术建议</h3>
              {rankLogic.tacticalAdvice.map((advice, index) => (
                <div key={index} className="mb-4 p-3 border-l-4 border-blue-500 bg-blue-50">
                  <h4 className="font-semibold">{advice.title}</h4>
                  <p className="text-sm mb-2">{advice.description}</p>
                  <ul className="text-xs space-y-1">
                    {advice.keyActions.map((action, i) => (
                      <li key={i}>• {action}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {currentView === 'history' && (
        <div>
          <h2>历史记录</h2>
          <div className="space-y-6">
            {/* 统计概览 */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h3>统计概览</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-2xl font-bold">{history.statistics.totalGames}</div>
                  <div className="text-sm text-gray-600">总游戏数</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{(history.statistics.winRates.overall * 100).toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">胜率</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{Math.floor(history.statistics.averageGameDuration / 60)}</div>
                  <div className="text-sm text-gray-600">平均时长(分)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{history.statistics.mostPlayedRank}</div>
                  <div className="text-sm text-gray-600">常用级数</div>
                </div>
              </div>
            </div>
            
            {/* 游戏记录列表 */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h3>最近游戏</h3>
              {history.getRecentGames(5).map(game => (
                <div key={game.id} className="border-b py-2 flex justify-between items-center">
                  <div>
                    <span className="font-medium">级数{game.currentRank}</span>
                    <span className="ml-4 text-sm text-gray-600">
                      {new Date(game.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="space-x-2">
                    {game.winningTeam && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        队伍{game.winningTeam}获胜
                      </span>
                    )}
                    <button 
                      onClick={() => history.startReplay(game.id)}
                      className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      回放
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* 回放界面 */}
            {history.replayState.isReplayMode && history.replayState.currentGameId && (
              <GameReplay
                gameRecord={history.loadGameRecord(history.replayState.currentGameId)!}
                replayState={history.replayState}
                onReplayControl={{
                  setProgress: history.setReplayProgress,
                  setSpeed: history.setReplaySpeed,
                  start: () => history.startReplay(history.replayState.currentGameId!),
                  stop: history.stopReplay
                }}
              />
            )}
          </div>
        </div>
      )}
      
      {currentView === 'export' && (
        <DataExport
          onExport={history.exportData}
          onImport={history.importData}
          availableRanks={[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]}
          totalGames={history.gameRecords.length}
        />
      )}
      
      {/* 快速操作栏 */}
      <div className="fixed bottom-4 right-4 space-y-2">
        <button
          onClick={() => {
            history.saveCurrentGame(
              gameState.cards,
              gameState.cardOwnership,
              gameState.currentRank,
              gameState.players,
              gameState.stats,
              { isCompleted: false }
            );
          }}
          className="block w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          保存游戏
        </button>
        
        <button
          onClick={() => rankLogic.refreshAnalysis()}
          className="block w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          刷新分析
        </button>
      </div>
    </div>
  );
}

export default AdvancedGuandanTracker;
```

## 📊 性能特点

- **高效分析**: 所有分析函数都使用useMemo缓存，避免重复计算
- **智能存储**: 自动管理localStorage，只保留必要数据
- **流畅回放**: 回放功能使用优化的时间轴算法
- **类型安全**: 完整的TypeScript类型支持
- **组件化**: 模块化设计，易于维护和扩展

## 🔧 配置选项

所有模块都支持灵活配置：

```typescript
// useGameHistory配置
const MAX_RECORDS = 10;  // 最大历史记录数

// gameAnalytics配置
const ANALYSIS_CACHE_TTL = 30000;  // 分析缓存时间(ms)

// DataExport配置
const EXPORT_FORMATS = ['json', 'csv', 'txt'];  // 支持的导出格式
```

## ✨ 总结

这套高级功能模块为掼蛋记牌器提供了完整的分析、记录和管理功能：

1. ✅ **智能分析** - 深度级牌控制力分析和战术建议
2. ✅ **完整记录** - 自动保存游戏历史，支持回放查看
3. ✅ **数据管理** - 灵活的导入导出功能
4. ✅ **可视化界面** - 直观的组件展示所有分析结果
5. ✅ **高度集成** - 与基础游戏状态完美配合

可以直接集成到现有的掼蛋记牌器项目中，提供专业级的游戏分析体验。