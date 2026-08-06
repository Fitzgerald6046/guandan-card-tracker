import { useEffect, useState } from 'react';
import type {
  AIAnalysisResult,
  GameState,
  TableInferenceViewModel
} from '../types/game';
import { buildInferenceViewModel } from '../utils/inferenceViewModel';

/** 保留上一帧可见标签，以进入/退出双阈值抑制临界概率闪烁。 */
export function useInferenceViewModel(
  gameState: GameState,
  analysis: AIAnalysisResult | null
): TableInferenceViewModel {
  const contextKey = `${gameState.gameId}:${gameState.config.gameMode ?? 'guandan'}:` +
    `${gameState.config.landlordPosition ?? ''}:${gameState.currentRank}`;
  const [state, setState] = useState<{
    contextKey: string;
    viewModel: TableInferenceViewModel;
  }>(() => ({
    contextKey,
    viewModel: buildInferenceViewModel(gameState, analysis)
  }));

  // 切换牌局或级牌时，渲染阶段就返回无旧状态版本，避免 effect 执行前
  // 短暂闪出上一局使用较低退出阈值保留的标签。
  const visibleViewModel = state.contextKey === contextKey
    ? state.viewModel
    : buildInferenceViewModel(gameState, analysis);

  useEffect(() => {
    setState(previous => ({
      contextKey,
      viewModel: buildInferenceViewModel(
        gameState,
        analysis,
        previous.contextKey === contextKey ? previous.viewModel : null
      )
    }));
  }, [analysis, contextKey, gameState]);

  return visibleViewModel;
}
