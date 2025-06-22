# Settings 组件

完整的掼蛋游戏设置管理组件，提供游戏配置、显示选项和数据管理功能。

## 功能特性

### 🎮 游戏设置
- **初始级数设置**: 选择游戏开始时的级数(2-A)
- **队伍分配调整**: 自定义玩家名称、队伍归属和位置
- **游戏规则选项**: 
  - 贡牌规则开关
  - 双升规则
  - 大小王升级
  - 同牌型升级
  - 最大回合数限制
  - 时间限制设置

### 🎨 显示设置
- **主题切换**: 浅色/深色/自动主题
- **卡牌大小调节**: 小/中/大三种尺寸
- **功能开关**:
  - 动画效果
  - 音效
  - 震动反馈
  - 自动保存
  - 统计信息显示
  - 紧凑模式
  - 高对比度模式

### 💾 数据管理
- **导出游戏记录**: 支持JSON/CSV/TXT格式
- **自动备份设置**: 定期备份游戏数据
- **数据清理**: 清除历史记录和重置设置

## 使用方法

### 基础用法

```tsx
import { Settings } from '../components/Settings';

function App() {
  const [showSettings, setShowSettings] = useState(false);

  const handleSettingsChange = (settings) => {
    console.log('设置已更新:', settings);
    // 处理设置变更
  };

  return (
    <div>
      <button onClick={() => setShowSettings(true)}>
        打开设置
      </button>
      
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  );
}
```

### 与GameContext集成

```tsx
import { useGame } from '../../contexts/GameContext';
import { Settings } from '../components/Settings';

function GameApp() {
  const { state, actions } = useGame();
  
  return (
    <Settings
      isOpen={state.ui.showSettings}
      onClose={() => actions.toggleSettings(false)}
      onSettingsChange={(settings) => {
        // 自动应用到游戏状态
        actions.updatePreferences(settings.displaySettings);
      }}
    />
  );
}
```

## Props 接口

```tsx
interface SettingsProps {
  /** 是否显示设置面板 */
  isOpen: boolean;
  /** 关闭设置面板回调 */
  onClose: () => void;
  /** 设置变更回调 */
  onSettingsChange?: (settings: any) => void;
}
```

## 设置数据结构

### 游戏设置
```tsx
interface GameSettings {
  initialRank: GameRank;           // 初始级数
  teamAssignment: TeamAssignment; // 队伍分配
  gameRules: GameRules;           // 游戏规则
}

interface TeamAssignment {
  player1: { name: string; team: Team; position: PlayerPosition };
  player2: { name: string; team: string; position: PlayerPosition };
  player3: { name: string; team: Team; position: PlayerPosition };
  player4: { name: string; team: Team; position: PlayerPosition };
}

interface GameRules {
  tributeEnabled: boolean;        // 贡牌规则
  doubleUpgrade: boolean;         // 双升规则
  jokerUpgrade: boolean;          // 大小王升级
  sameCardUpgrade: boolean;       // 同牌型升级
  maxRounds: number | null;       // 最大回合数
  timeLimit: number | null;       // 时间限制
}
```

### 显示设置
```tsx
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
}
```

### 数据管理
```tsx
interface DataManagement {
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  maxBackups: number;
  exportFormat: 'json' | 'csv' | 'txt';
}
```

## 核心功能说明

### 1. 游戏设置管理
- **级数选择**: 2-A的完整级数范围
- **队伍配置**: 灵活的4人队伍分配
- **规则定制**: 多种掼蛋变体规则支持

### 2. UI个性化
- **主题系统**: 完整的明暗主题切换
- **尺寸适配**: 多设备屏幕尺寸支持
- **无障碍**: 高对比度和简化界面选项

### 3. 数据持久化
- **本地存储**: 自动保存所有设置
- **数据导出**: 多格式游戏记录导出
- **备份恢复**: 定期自动备份机制

## 样式特性

### 响应式设计
- 移动端友好的选项卡切换
- 自适应的表格和表单布局
- 触摸优化的交互元素

### 视觉反馈
- 平滑的过渡动画
- 清晰的状态指示
- 直观的开关控件

### 主题支持
- 完整的明暗主题
- 高对比度模式
- 自定义颜色方案

## 事件处理

### 设置变更
```tsx
const handleSettingsChange = (settings) => {
  // 游戏设置
  if (settings.initialRank) {
    actions.setRank(settings.initialRank);
  }
  
  // 显示设置
  if (settings.displaySettings) {
    actions.updatePreferences(settings.displaySettings);
  }
  
  // 数据管理
  if (settings.dataManagement) {
    localStorage.setItem('backup-settings', JSON.stringify(settings.dataManagement));
  }
};
```

### 数据导出
```tsx
const exportData = async () => {
  const gameData = {
    gameState: state.gameState,
    settings: getAllSettings(),
    exportTime: new Date().toISOString()
  };
  
  // 创建下载链接
  const blob = new Blob([JSON.stringify(gameData, null, 2)], { 
    type: 'application/json' 
  });
  downloadFile(blob, `guandan-export-${Date.now()}.json`);
};
```

### 数据清理
```tsx
const clearData = () => {
  // 清除localStorage
  localStorage.removeItem('guandan-game-history');
  localStorage.removeItem('guandan-settings');
  
  // 重置游戏状态
  actions.resetGame();
};
```

## 扩展性

### 添加新设置选项
1. 在对应的interface中添加新字段
2. 在UI中添加控制组件
3. 在更新函数中处理新设置

### 自定义导出格式
1. 在exportFormat中添加新格式
2. 在exportGameData函数中添加处理逻辑
3. 设置对应的MIME类型和文件扩展名

### 集成外部服务
- 云端备份存储
- 社交分享功能
- 统计数据分析

## 注意事项

1. **数据安全**: 敏感操作需要二次确认
2. **性能优化**: 大量设置项使用懒加载
3. **兼容性**: 考虑localStorage限制和浏览器差异
4. **用户体验**: 提供明确的操作反馈和错误提示

## 更新日志

### v1.0.0
- 初始版本发布
- 完整的三大功能模块
- 响应式设计支持
- 数据导出和备份功能 