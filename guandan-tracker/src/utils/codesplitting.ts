/**
 * 代码分割和动态导入工具
 * 提供组件和模块的懒加载功能
 */

import React from 'react';

// ==================== 类型定义 ====================

interface LazyComponentOptions {
  /** 加载失败时的重试次数 */
  retryCount?: number;
  /** 重试延迟时间(ms) */
  retryDelay?: number;
  /** 加载超时时间(ms) */
  timeout?: number;
  /** 预加载策略 */
  preload?: 'hover' | 'visible' | 'idle' | false;
}

interface LoadableComponentProps {
  /** 加载中的占位符 */
  fallback?: React.ComponentType;
  /** 错误边界组件 */
  errorBoundary?: React.ComponentType<{ error: Error; retry: () => void }>;
  /** 组件加载完成回调 */
  onLoad?: () => void;
  /** 组件加载失败回调 */
  onError?: (error: Error) => void;
}

interface ChunkInfo {
  name: string;
  size?: number;
  isLoaded: boolean;
  loadTime?: number;
  error?: Error;
}

interface PreloadStrategy {
  strategy: 'hover' | 'visible' | 'idle' | 'immediate';
  delay?: number;
  threshold?: number;
}

// ==================== 全局状态管理 ====================

class CodeSplittingManager {
  private loadedChunks = new Set<string>();
  private preloadStrategies = new Map<string, PreloadStrategy>();
  private chunkInfo = new Map<string, ChunkInfo>();
  
  /**
   * 注册chunk信息
   */
  registerChunk(name: string, info: Partial<ChunkInfo>) {
    this.chunkInfo.set(name, {
      name,
      isLoaded: false,
      ...info
    });
  }
  
  /**
   * 标记chunk为已加载
   */
  markChunkLoaded(name: string, loadTime?: number) {
    this.loadedChunks.add(name);
    const info = this.chunkInfo.get(name);
    if (info) {
      info.isLoaded = true;
      info.loadTime = loadTime;
    }
  }
  
  /**
   * 标记chunk加载失败
   */
  markChunkError(name: string, error: Error) {
    const info = this.chunkInfo.get(name);
    if (info) {
      info.error = error;
    }
  }
  
  /**
   * 检查chunk是否已加载
   */
  isChunkLoaded(name: string): boolean {
    return this.loadedChunks.has(name);
  }
  
  /**
   * 获取chunk信息
   */
  getChunkInfo(name: string): ChunkInfo | undefined {
    return this.chunkInfo.get(name);
  }
  
  /**
   * 获取所有chunk信息
   */
  getAllChunkInfo(): ChunkInfo[] {
    return Array.from(this.chunkInfo.values());
  }
  
  /**
   * 设置预加载策略
   */
  setPreloadStrategy(chunkName: string, strategy: PreloadStrategy) {
    this.preloadStrategies.set(chunkName, strategy);
  }
  
  /**
   * 获取预加载策略
   */
  getPreloadStrategy(chunkName: string): PreloadStrategy | undefined {
    return this.preloadStrategies.get(chunkName);
  }
}

const codeManager = new CodeSplittingManager();

// ==================== 工具函数 ====================

/**
 * 延迟执行
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带重试的动态导入
 */
async function importWithRetry<T = unknown>(
  importFn: () => Promise<T>,
  options: LazyComponentOptions = {}
): Promise<T> {
  const {
    retryCount = 3,
    retryDelay = 1000,
    timeout = 10000
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      // 添加超时控制
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Import timeout')), timeout);
      });
      
      const result = await Promise.race([
        importFn(),
        timeoutPromise
      ]);
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < retryCount) {
        await delay(retryDelay * Math.pow(2, attempt)); // 指数退避
      }
    }
  }
  
  throw lastError!;
}

/**
 * 创建错误边界
 */
function createErrorBoundary(
  ErrorComponent?: React.ComponentType<{ error: Error; retry: () => void }>
): React.ComponentType<{
  children: React.ReactNode;
  onRetry?: () => void;
  onError?: (error: Error) => void;
}> {
  
  return class ErrorBoundary extends React.Component<
    {
      children: React.ReactNode;
      onRetry?: () => void;
      onError?: (error: Error) => void;
    },
    { hasError: boolean; error: Error | null }
  > {
    constructor(props: {
      children: React.ReactNode;
      onRetry?: () => void;
      onError?: (error: Error) => void;
    }) {
      super(props);
      this.state = { hasError: false, error: null };
    }
    
    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }
    
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      console.error('Lazy component loading error:', error, errorInfo);
      this.props.onError?.(error);
    }
    
    handleRetry = () => {
      this.setState({ hasError: false, error: null });
      this.props.onRetry?.();
    }
    
    render() {
      if (this.state.hasError) {
        if (ErrorComponent) {
          return React.createElement(ErrorComponent, {
            error: this.state.error!,
            retry: this.handleRetry
          });
        }
        
        return React.createElement('div', {
          className: 'p-4 border border-red-300 rounded-lg bg-red-50'
        }, [
          React.createElement('h3', {
            key: 'title',
            className: 'text-red-800 font-medium mb-2'
          }, '组件加载失败'),
          React.createElement('p', {
            key: 'message',
            className: 'text-red-600 text-sm mb-3'
          }, this.state.error?.message || '未知错误'),
          React.createElement('button', {
            key: 'retry',
            onClick: this.handleRetry,
            className: 'bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors'
          }, '重试')
        ]);
      }
      
      return this.props.children;
    }
  };
}

/**
 * 默认加载占位符
 */
const DefaultFallback: React.FC = () => React.createElement('div', {
  className: 'flex items-center justify-center p-8'
}, [
  React.createElement('div', {
    key: 'spinner',
    className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500'
  }),
  React.createElement('span', {
    key: 'text',
    className: 'ml-2 text-gray-600'
  }, '加载中...')
]);

// ==================== 主要功能函数 ====================

/**
 * 创建懒加载组件
 */
export function createLazyComponent<P extends object>(
  importFn: () => Promise<{ default: React.ComponentType<P> }>,
  chunkName?: string,
  options: LazyComponentOptions = {}
): React.ComponentType<P & LoadableComponentProps> {
  
  // 注册chunk信息
  if (chunkName) {
    codeManager.registerChunk(chunkName, { name: chunkName });
  }
  
  const LazyComponent = React.lazy(async () => {
    const startTime = performance.now();
    
    try {
      const module = await importWithRetry(importFn, options);
      
      const loadTime = performance.now() - startTime;
      if (chunkName) {
        codeManager.markChunkLoaded(chunkName, loadTime);
      }
      
      return module;
    } catch (error) {
      if (chunkName) {
        codeManager.markChunkError(chunkName, error as Error);
      }
      throw error;
    }
  });
  
  const LoadableComponent: React.FC<P & LoadableComponentProps> = (props) => {
      const {
        fallback: FallbackComponent,
        errorBoundary: ErrorBoundaryComponent,
        onLoad,
        onError,
        ...componentProps
      } = props;
      
      const ErrorBoundary = createErrorBoundary(ErrorBoundaryComponent);
      const Fallback = FallbackComponent || DefaultFallback;
      
      React.useEffect(() => {
        if (chunkName && codeManager.isChunkLoaded(chunkName)) {
          onLoad?.();
        }
      }, [onLoad]);
      
      return React.createElement(ErrorBoundary, { onError },
        React.createElement(React.Suspense, {
          fallback: React.createElement(Fallback)
        }, React.createElement(LazyComponent, componentProps as P))
      );
  };

  return LoadableComponent;
}

/**
 * 预加载组件
 */
export function preloadComponent<T>(
  importFn: () => Promise<T>,
  chunkName?: string
): Promise<T | undefined> {
  if (chunkName && codeManager.isChunkLoaded(chunkName)) {
    return Promise.resolve();
  }
  
  return importWithRetry(importFn);
}

/**
 * 基于交互预加载
 */
export function preloadOnInteraction<T>(
  element: HTMLElement,
  importFn: () => Promise<T>,
  event: 'hover' | 'click' | 'focus' = 'hover',
  delay: number = 0
): () => void {
  let isPreloaded = false;
  
  const handleInteraction = () => {
    if (isPreloaded) return;
    
    isPreloaded = true;
    
    if (delay > 0) {
      setTimeout(() => preloadComponent(importFn), delay);
    } else {
      preloadComponent(importFn);
    }
  };
  
  const eventMap = {
    hover: 'mouseenter',
    click: 'click',
    focus: 'focus'
  };
  
  const eventName = eventMap[event];
  element.addEventListener(eventName, handleInteraction, { once: true });
  
  return () => {
    element.removeEventListener(eventName, handleInteraction);
  };
}

/**
 * 基于Intersection Observer的预加载
 */
export function preloadOnVisible<T>(
  element: HTMLElement,
  importFn: () => Promise<T>,
  threshold: number = 0.1
): () => void {
  if (!window.IntersectionObserver) {
    // 不支持IntersectionObserver时立即预加载
    preloadComponent(importFn);
    return () => {};
  }
  
  let isPreloaded = false;
  
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isPreloaded) {
          isPreloaded = true;
          preloadComponent(importFn);
          observer.disconnect();
        }
      });
    },
    { threshold }
  );
  
  observer.observe(element);
  
  return () => {
    observer.disconnect();
  };
}

/**
 * 空闲时预加载
 */
export function preloadOnIdle<T>(
  importFn: () => Promise<T>,
  timeout: number = 5000
): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(
      () => preloadComponent(importFn),
      { timeout }
    );
  } else {
    // 不支持requestIdleCallback时使用setTimeout
    setTimeout(() => preloadComponent(importFn), timeout);
  }
}

/**
 * 路由级代码分割
 */
export function createLazyRoute<P extends object>(
  importFn: () => Promise<{ default: React.ComponentType<P> }>,
  routeName: string,
  preloadStrategy?: PreloadStrategy
): React.ComponentType<P> {
  
  const LazyRouteComponent = createLazyComponent(importFn, `route-${routeName}`);
  
  if (preloadStrategy) {
    codeManager.setPreloadStrategy(`route-${routeName}`, preloadStrategy);
  }
  
  return LazyRouteComponent;
}

/**
 * 模块级代码分割
 */
export function createLazyModule<T = unknown>(
  importFn: () => Promise<T>,
  moduleName: string
): () => Promise<T> {
  let modulePromise: Promise<T> | null = null;
  
  return () => {
    if (!modulePromise) {
      modulePromise = importWithRetry(importFn);
      codeManager.registerChunk(`module-${moduleName}`, { name: moduleName });
    }
    return modulePromise;
  };
}

// ==================== React Hook ====================

/**
 * 使用代码分割的Hook
 */
export function useCodeSplitting() {
  const [chunkInfo, setChunkInfo] = React.useState<ChunkInfo[]>([]);
  
  React.useEffect(() => {
    const updateChunkInfo = () => {
      setChunkInfo(codeManager.getAllChunkInfo());
    };
    
    // 初始更新
    updateChunkInfo();
    
    // 定期更新（用于开发调试）
    const interval = setInterval(updateChunkInfo, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return {
    chunks: chunkInfo,
    isChunkLoaded: (name: string) => codeManager.isChunkLoaded(name),
    getChunkInfo: (name: string) => codeManager.getChunkInfo(name),
    preloadComponent,
    preloadOnInteraction,
    preloadOnVisible,
    preloadOnIdle
  };
}

// ==================== 预定义的懒加载组件 ====================

// 游戏分析组件 (暂时注释掉，组件不存在)
// export const LazyGameAnalysis = createLazyComponent(
//   () => import('../components/GameAnalysis'),
//   'game-analysis',
//   { preload: 'hover' }
// );

// 历史记录组件 (暂时注释掉，组件不存在)
// export const LazyGameHistory = createLazyComponent(
//   () => import('../components/GameHistory'),
//   'game-history',
//   { preload: 'idle' }
// );

// 数据导出组件
export const LazyDataExport = createLazyComponent(
  () => import('../components/DataExport'),
  'data-export',
  { preload: false }
);

// 游戏回放组件
export const LazyGameReplay = createLazyComponent(
  () => import('../components/GameReplay'),
  'game-replay',
  { preload: false }
);

// 设置页面
export const LazySettings = createLazyComponent(
  () => import('../components/Settings'),
  'settings',
  { preload: 'visible' }
);

// ==================== 导出 ====================

export default {
  createLazyComponent,
  createLazyRoute,
  createLazyModule,
  preloadComponent,
  preloadOnInteraction,
  preloadOnVisible,
  preloadOnIdle,
  useCodeSplitting
};

export type {
  LazyComponentOptions,
  LoadableComponentProps,
  ChunkInfo,
  PreloadStrategy
};
