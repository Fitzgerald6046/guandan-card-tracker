import React, { useState } from 'react';
import { GameProvider, useGame } from '../../contexts/GameContext';
import RankSelector from './RankSelector';
import type { GameRank } from '../../types';
import { GameStatus } from '../../types';

/**
 * 集成示例：在 App.tsx 中使用 RankSelector 替换现有的 LevelSelector
 * 
 * 这个示例展示了如何将 RankSelector 组件集成到现有的掼蛋记牌器应用中
 */

const GameAppWithRankSelector: React.FC = () => {
  const { state, setLevel, startGame } = useGame();
  const [showRankSelector, setShowRankSelector] = useState(false);
  const [playerNames, setPlayerNames] = useState(['您', '左方玩家', '上方玩家', '右方玩家']);

  const handleRankChange = (newRank: GameRank) => {
    setLevel(newRank);
    setShowRankSelector(false);
  };

  const handleStartGame = () => {
    startGame(playerNames);
  };

  const renderStartScreen = () => (
    <div className="min-h-screen bg-green-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">掼蛋记牌器</h1>
        
        {/* 玩家名称设置 */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">设置玩家名称</h2>
          {playerNames.map((name, index) => (
            <div key={index} className="mb-3">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {['您', '左方玩家', '上方玩家', '右方玩家'][index]}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  const newNames = [...playerNames];
                  newNames[index] = e.target.value;
                  setPlayerNames(newNames);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`输入${['您', '左方玩家', '上方玩家', '右方玩家'][index]}的名称`}
              />
            </div>
          ))}
        </div>

        {/* 级数选择器 - 替换原有的 LevelSelector */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">级数设置</h2>
          <RankSelector
            currentRank={state.gameConfig.level.current}
            onRankChange={handleRankChange}
            allCards={state.allCards}
            className="mb-4"
          />
        </div>

        <button
          onClick={handleStartGame}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
        >
          开始游戏
        </button>
      </div>
    </div>
  );

  if (state.gameConfig.status === GameStatus.WAITING) {
    return renderStartScreen();
  }

  return (
    <div className="relative min-h-screen bg-green-800 p-4">
      {/* 游戏主界面 */}
      <div className="text-center text-white mb-4">
        <h1 className="text-2xl font-bold">掼蛋游戏进行中</h1>
        <p>当前级数: {state.gameConfig.level.current}</p>
      </div>

      {/* 游戏内容区域 */}
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
        <div className="text-center text-gray-600">
          游戏界面内容...
          <br />
          (这里会显示 GameBoard 等其他组件)
        </div>
      </div>
      
      {/* 浮动操作按钮 */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setShowRankSelector(!showRankSelector)}
          className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
          title="级数设置"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </button>
      </div>

      {/* 级数选择弹窗 */}
      {showRankSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">级数设置</h3>
              <button
                onClick={() => setShowRankSelector(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <RankSelector
                currentRank={state.gameConfig.level.current}
                onRankChange={handleRankChange}
                allCards={state.allCards}
                disabled={state.gameConfig.status === GameStatus.PLAYING}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 完整的应用组件，包含 GameProvider
 */
const IntegrationExample: React.FC = () => {
  return (
    <GameProvider>
      <GameAppWithRankSelector />
    </GameProvider>
  );
};

export default IntegrationExample;

/**
 * 使用说明：
 * 
 * 1. 在 App.tsx 中替换现有的 LevelSelector：
 *    ```tsx
 *    import RankSelector from './components/RankSelector';
 *    
 *    // 替换这行：
 *    // <LevelSelector ... />
 *    
 *    // 为：
 *    <RankSelector
 *      currentRank={state.gameConfig.level.current}
 *      onRankChange={handleRankChange}
 *      allCards={state.allCards}
 *    />
 *    ```
 * 
 * 2. 更新导入语句：
 *    ```tsx
 *    // 删除或注释掉：
 *    // import LevelSelector from './components/LevelSelector';
 *    
 *    // 添加：
 *    import RankSelector from './components/RankSelector';
 *    ```
 * 
 * 3. 级数变更处理：
 *    RankSelector 内置了确认对话框，所以回调函数会在用户确认后才被调用
 * 
 * 4. 统计数据：
 *    传入 allCards 数组以显示准确的级牌和配牌统计信息
 * 
 * 5. 样式调整：
 *    RankSelector 使用 Tailwind CSS，与现有样式兼容
 */ 