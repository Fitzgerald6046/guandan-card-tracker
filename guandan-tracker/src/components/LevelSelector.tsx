import React from 'react';
import { Rank } from '../types';

interface LevelSelectorProps {
  currentLevel: Rank;
  onLevelChange: (level: Rank) => void;
  disabled?: boolean;
}

const LevelSelector: React.FC<LevelSelectorProps> = ({
  currentLevel,
  onLevelChange,
  disabled = false
}) => {
  const levels = [
    Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
    Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE
  ];

  const getLevelName = (level: Rank): string => {
    switch (level) {
      case Rank.TWO: return '2';
      case Rank.THREE: return '3';
      case Rank.FOUR: return '4';
      case Rank.FIVE: return '5';
      case Rank.SIX: return '6';
      case Rank.SEVEN: return '7';
      case Rank.EIGHT: return '8';
      case Rank.NINE: return '9';
      case Rank.TEN: return '10';
      case Rank.JACK: return 'J';
      case Rank.QUEEN: return 'Q';
      case Rank.KING: return 'K';
      case Rank.ACE: return 'A';
      default: return level;
    }
  };

  const getNextLevel = (level: Rank): Rank => {
    const currentIndex = levels.findIndex(l => l === level);
    if (currentIndex === -1 || currentIndex === levels.length - 1) {
      return levels[0]; // 从A回到2
    }
    return levels[currentIndex + 1];
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4">级数设置</h3>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          当前级数
        </label>
        <div className="text-2xl font-bold text-blue-600 mb-2">
          {getLevelName(currentLevel)}
        </div>
        <div className="text-sm text-gray-600">
          下一级数: {getLevelName(getNextLevel(currentLevel))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          选择级数
        </label>
        <div className="grid grid-cols-7 gap-2">
          {levels.map((level) => (
            <button
              key={level}
              onClick={() => onLevelChange(level)}
              disabled={disabled}
              className={`
                w-12 h-12 rounded-lg border font-semibold text-sm
                ${currentLevel === level
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                transition-colors duration-200
              `}
            >
              {getLevelName(level)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <div className="text-sm text-yellow-800">
          <div className="font-semibold mb-1">级牌说明:</div>
          <ul className="text-xs space-y-1">
            <li>• 当前级数的所有牌都是级牌</li>
            <li>• 红心级牌作为配牌，具有特殊地位</li>
            <li>• 级牌比普通牌大，但小于主牌</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LevelSelector;