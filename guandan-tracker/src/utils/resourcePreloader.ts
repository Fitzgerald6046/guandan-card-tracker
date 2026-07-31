/**
 * 资源预加载工具
 * 智能预加载关键资源，提升应用性能
 */

import React from 'react';

// ==================== 类型定义 ====================

type ResourceType = 'script' | 'style' | 'image' | 'font' | 'audio' | 'video' | 'document';

interface PreloadResource {
  /** 资源URL */
  url: string;
  /** 资源类型 */
  type: ResourceType;
  /** 优先级 */
  priority: 'high' | 'medium' | 'low';
  /** 是否关键资源 */
  critical?: boolean;
  /** MIME类型 */
  mimeType?: string;
  /** 跨域设置 */
  crossOrigin?: 'anonymous' | 'use-credentials';
  /** 媒体查询 */
  media?: string;
  /** 引用策略 */
  referrerPolicy?: string;
}

interface PreloadOptions {
  /** 最大并发数 */
  maxConcurrent?: number;
  /** 超时时间(ms) */
  timeout?: number;
  /** 是否使用Service Worker缓存 */
  useServiceWorkerCache?: boolean;
  /** 网络质量阈值 */
  networkQualityThreshold?: 'slow' | 'fast' | 'any';
  /** 是否在低电量时跳过 */
  skipOnLowBattery?: boolean;
}

interface PreloadResult {
  url: string;
  success: boolean;
  loadTime: number;
  size?: number;
  error?: Error;
}

interface ResourceCache {
  url: string;
  timestamp: number;
  size: number;
  type: ResourceType;
  expiresAt: number;
}

interface NetworkInfo {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

interface NetworkConnection extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface BatteryInfo {
  level: number;
  charging: boolean;
}

interface NavigatorWithDeviceInfo extends Navigator {
  connection?: NetworkConnection;
  getBattery?: () => Promise<BatteryInfo>;
}

type PreloadedResource =
  | HTMLImageElement
  | HTMLScriptElement
  | HTMLLinkElement
  | FontFace
  | HTMLMediaElement
  | Response;

// ==================== 缓存管理 ====================

class ResourceCacheManager {
  private cache = new Map<string, ResourceCache>();
  private readonly CACHE_KEY = 'resource_preload_cache';
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24小时
  
  constructor() {
    this.loadFromStorage();
  }
  
  /**
   * 从localStorage加载缓存
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        Object.entries(data).forEach(([url, cacheItem]) => {
          this.cache.set(url, cacheItem as ResourceCache);
        });
        
        // 清理过期缓存
        this.cleanExpiredCache();
      }
    } catch (error) {
      console.warn('Failed to load resource cache from storage:', error);
    }
  }
  
  /**
   * 保存缓存到localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Object.fromEntries(this.cache.entries());
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save resource cache to storage:', error);
    }
  }
  
  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    const expired = Array.from(this.cache.entries())
      .filter(([, item]) => item.expiresAt < now)
      .map(([url]) => url);
    
    expired.forEach(url => this.cache.delete(url));
    
    if (expired.length > 0) {
      this.saveToStorage();
    }
  }
  
  /**
   * 检查资源是否已缓存
   */
  isCached(url: string): boolean {
    const item = this.cache.get(url);
    return item ? item.expiresAt > Date.now() : false;
  }
  
  /**
   * 添加资源到缓存
   */
  addToCache(url: string, type: ResourceType, size: number, ttl?: number): void {
    const now = Date.now();
    this.cache.set(url, {
      url,
      timestamp: now,
      size,
      type,
      expiresAt: now + (ttl || this.DEFAULT_TTL)
    });
    this.saveToStorage();
  }
  
  /**
   * 获取缓存信息
   */
  getCacheInfo(): { totalSize: number; itemCount: number; items: ResourceCache[] } {
    this.cleanExpiredCache();
    const items = Array.from(this.cache.values());
    const totalSize = items.reduce((sum, item) => sum + item.size, 0);
    
    return {
      totalSize,
      itemCount: items.length,
      items
    };
  }
  
  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    localStorage.removeItem(this.CACHE_KEY);
  }
}

// ==================== 网络状态检测 ====================

class NetworkMonitor {
  private networkInfo: NetworkInfo | null = null;
  
  constructor() {
    this.updateNetworkInfo();
    this.setupNetworkListener();
  }
  
  /**
   * 更新网络信息
   */
  private updateNetworkInfo(): void {
    if ('connection' in navigator) {
      const connection = (navigator as NavigatorWithDeviceInfo).connection;
      if (!connection) return;
      this.networkInfo = {
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
        saveData: connection.saveData || false
      };
    }
  }
  
  /**
   * 设置网络状态监听
   */
  private setupNetworkListener(): void {
    if ('connection' in navigator) {
      const connection = (navigator as NavigatorWithDeviceInfo).connection;
      if (!connection) return;
      connection.addEventListener('change', () => {
        this.updateNetworkInfo();
      });
    }
  }
  
  /**
   * 获取网络质量
   */
  getNetworkQuality(): 'slow' | 'fast' | 'unknown' {
    if (!this.networkInfo) return 'unknown';
    
    const { effectiveType, downlink } = this.networkInfo;
    
    // 基于有效连接类型判断
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      return 'slow';
    }
    
    // 基于下行速度判断
    if (downlink < 1.5) {
      return 'slow';
    } else if (downlink > 5) {
      return 'fast';
    }
    
    return 'unknown';
  }
  
  /**
   * 是否启用了数据节省模式
   */
  isDataSaverEnabled(): boolean {
    return this.networkInfo?.saveData || false;
  }
  
  /**
   * 获取完整网络信息
   */
  getNetworkInfo(): NetworkInfo | null {
    return this.networkInfo;
  }
}

// ==================== 电池状态检测 ====================

class BatteryMonitor {
  private batteryInfo: BatteryInfo | null = null;
  
  constructor() {
    this.initBatteryAPI();
  }
  
  /**
   * 初始化电池API
   */
  private async initBatteryAPI(): Promise<void> {
    try {
      const getBattery = (navigator as NavigatorWithDeviceInfo).getBattery;
      if (getBattery) {
        this.batteryInfo = await getBattery.call(navigator);
      }
    } catch (error) {
      console.warn('Battery API not available:', error);
    }
  }
  
  /**
   * 检查是否为低电量
   */
  isLowBattery(): boolean {
    if (!this.batteryInfo) return false;
    
    const { level, charging } = this.batteryInfo;
    
    // 如果正在充电，不算低电量
    if (charging) return false;
    
    // 电量低于20%算低电量
    return level < 0.2;
  }
  
  /**
   * 获取电池信息
   */
  getBatteryInfo(): BatteryInfo | null {
    return this.batteryInfo;
  }
}

// ==================== 主预加载器 ====================

class ResourcePreloader {
  private cache = new ResourceCacheManager();
  private networkMonitor = new NetworkMonitor();
  private batteryMonitor = new BatteryMonitor();
  private loadingQueue = new Map<string, Promise<PreloadResult>>();
  private concurrentLoads = 0;
  
  /**
   * 预加载单个资源
   */
  async preloadResource(
    resource: PreloadResource,
    options: PreloadOptions = {}
  ): Promise<PreloadResult> {
    const {
      maxConcurrent = 6,
      timeout = 10000,
      useServiceWorkerCache = true,
      networkQualityThreshold = 'any',
      skipOnLowBattery = true
    } = options;
    
    // 检查是否已在加载队列中
    if (this.loadingQueue.has(resource.url)) {
      return this.loadingQueue.get(resource.url)!;
    }
    
    // 检查网络质量
    const networkQuality = this.networkMonitor.getNetworkQuality();
    if (networkQualityThreshold !== 'any' && networkQuality !== networkQualityThreshold) {
      throw new Error(`Network quality ${networkQuality} does not meet threshold ${networkQualityThreshold}`);
    }
    
    // 检查数据节省模式
    if (this.networkMonitor.isDataSaverEnabled() && !resource.critical) {
      throw new Error('Skipping non-critical resource due to data saver mode');
    }
    
    // 检查电池电量
    if (skipOnLowBattery && this.batteryMonitor.isLowBattery() && !resource.critical) {
      throw new Error('Skipping non-critical resource due to low battery');
    }
    
    // 检查是否已缓存
    if (this.cache.isCached(resource.url)) {
      return {
        url: resource.url,
        success: true,
        loadTime: 0
      };
    }
    
    // 等待并发限制
    await this.waitForConcurrencySlot(maxConcurrent);
    
    const loadPromise = this.performPreload(resource, timeout, useServiceWorkerCache);
    this.loadingQueue.set(resource.url, loadPromise);
    
    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.loadingQueue.delete(resource.url);
      this.concurrentLoads--;
    }
  }
  
  /**
   * 等待并发位置
   */
  private async waitForConcurrencySlot(maxConcurrent: number): Promise<void> {
    while (this.concurrentLoads >= maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.concurrentLoads++;
  }
  
  /**
   * 执行实际的预加载
   */
  private async performPreload(
    resource: PreloadResource,
    timeout: number,
    useServiceWorkerCache: boolean
  ): Promise<PreloadResult> {
    void useServiceWorkerCache;
    const startTime = performance.now();
    
    try {
      let loadPromise: Promise<PreloadedResource>;
      
      switch (resource.type) {
        case 'image':
          loadPromise = this.preloadImage(resource);
          break;
        case 'script':
          loadPromise = this.preloadScript(resource);
          break;
        case 'style':
          loadPromise = this.preloadStyle(resource);
          break;
        case 'font':
          loadPromise = this.preloadFont(resource);
          break;
        case 'audio':
        case 'video':
          loadPromise = this.preloadMedia(resource);
          break;
        default:
          loadPromise = this.preloadGeneric(resource);
      }
      
      // 添加超时控制
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Preload timeout')), timeout);
      });
      
      const result = await Promise.race([loadPromise, timeoutPromise]);
      const loadTime = performance.now() - startTime;
      
      // 添加到缓存
      const size = this.estimateResourceSize(resource, result);
      this.cache.addToCache(resource.url, resource.type, size);
      
      return {
        url: resource.url,
        success: true,
        loadTime,
        size
      };
    } catch (error) {
      const loadTime = performance.now() - startTime;
      return {
        url: resource.url,
        success: false,
        loadTime,
        error: error as Error
      };
    }
  }
  
  /**
   * 预加载图片
   */
  private preloadImage(resource: PreloadResource): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      if (resource.crossOrigin) {
        img.crossOrigin = resource.crossOrigin;
      }
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${resource.url}`));
      img.src = resource.url;
    });
  }
  
  /**
   * 预加载脚本
   */
  private preloadScript(resource: PreloadResource): Promise<HTMLScriptElement> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = resource.url;
      script.async = true;
      
      if (resource.crossOrigin) {
        script.crossOrigin = resource.crossOrigin;
      }
      
      script.onload = () => {
        document.head.removeChild(script);
        resolve(script);
      };
      script.onerror = () => {
        document.head.removeChild(script);
        reject(new Error(`Failed to load script: ${resource.url}`));
      };
      
      document.head.appendChild(script);
    });
  }
  
  /**
   * 预加载样式
   */
  private preloadStyle(resource: PreloadResource): Promise<HTMLLinkElement> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'style';
      link.href = resource.url;
      
      if (resource.media) {
        link.media = resource.media;
      }
      
      if (resource.crossOrigin) {
        link.crossOrigin = resource.crossOrigin;
      }
      
      link.onload = () => resolve(link);
      link.onerror = () => reject(new Error(`Failed to load style: ${resource.url}`));
      
      document.head.appendChild(link);
    });
  }
  
  /**
   * 预加载字体
   */
  private preloadFont(resource: PreloadResource): Promise<FontFace | Response> {
    // 优先使用Font Loading API
    if ('FontFace' in window && resource.mimeType) {
      return new Promise((resolve, reject) => {
        const fontFace = new FontFace('preload-font', `url(${resource.url})`, {
          display: 'swap'
        });
        
        fontFace.load()
          .then(() => resolve(fontFace))
          .catch(reject);
      });
    }
    
    // 回退到fetch
    return fetch(resource.url);
  }
  
  /**
   * 预加载媒体
   */
  private preloadMedia(resource: PreloadResource): Promise<HTMLMediaElement> {
    return new Promise((resolve, reject) => {
      const media = resource.type === 'audio' 
        ? document.createElement('audio')
        : document.createElement('video');
      
      media.preload = 'metadata';
      media.src = resource.url;
      
      if (resource.crossOrigin) {
        media.crossOrigin = resource.crossOrigin;
      }
      
      media.onloadedmetadata = () => resolve(media);
      media.onerror = () => reject(new Error(`Failed to load media: ${resource.url}`));
      
      media.load();
    });
  }
  
  /**
   * 通用预加载
   */
  private preloadGeneric(resource: PreloadResource): Promise<Response> {
    const init: RequestInit = {};
    
    if (resource.referrerPolicy) {
      init.referrerPolicy = resource.referrerPolicy as ReferrerPolicy;
    }
    
    return fetch(resource.url, init);
  }
  
  /**
   * 估算资源大小
   */
  private estimateResourceSize(
    resource: PreloadResource,
    result: PreloadedResource
  ): number {
    // 尝试从响应头获取大小
    if (result instanceof Response) {
      const contentLength = result.headers.get('content-length');
      if (contentLength) {
        return parseInt(contentLength, 10);
      }
    }
    
    // 基于资源类型估算
    const sizeEstimates: Record<ResourceType, number> = {
      script: 50 * 1024,   // 50KB
      style: 20 * 1024,    // 20KB
      image: 100 * 1024,   // 100KB
      font: 200 * 1024,    // 200KB
      audio: 3 * 1024 * 1024,  // 3MB
      video: 10 * 1024 * 1024, // 10MB
      document: 30 * 1024  // 30KB
    };
    
    return sizeEstimates[resource.type] || 50 * 1024;
  }
  
  /**
   * 批量预加载资源
   */
  async preloadResources(
    resources: PreloadResource[],
    options: PreloadOptions = {}
  ): Promise<PreloadResult[]> {
    // 按优先级排序
    const sortedResources = resources.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    // 分批处理关键和非关键资源
    const criticalResources = sortedResources.filter(r => r.critical);
    const nonCriticalResources = sortedResources.filter(r => !r.critical);
    
    // 先预加载关键资源
    const criticalResults = await Promise.allSettled(
      criticalResources.map(resource => this.preloadResource(resource, options))
    );
    
    // 然后预加载非关键资源
    const nonCriticalResults = await Promise.allSettled(
      nonCriticalResources.map(resource => this.preloadResource(resource, options))
    );
    
    // 合并结果
    const allResults = [...criticalResults, ...nonCriticalResults];
    
    return allResults.map(result => 
      result.status === 'fulfilled' 
        ? result.value 
        : {
            url: '',
            success: false,
            loadTime: 0,
            error: result.reason
          }
    );
  }
  
  /**
   * 获取缓存信息
   */
  getCacheInfo() {
    return this.cache.getCacheInfo();
  }
  
  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clearCache();
  }
  
  /**
   * 获取网络信息
   */
  getNetworkInfo() {
    return this.networkMonitor.getNetworkInfo();
  }
  
  /**
   * 获取电池信息
   */
  getBatteryInfo() {
    return this.batteryMonitor.getBatteryInfo();
  }
}

// ==================== 预定义资源配置 ====================

/**
 * 掼蛋应用的关键资源配置
 */
export const CRITICAL_RESOURCES: PreloadResource[] = [
  // 关键样式
  {
    url: '/static/css/main.css',
    type: 'style',
    priority: 'high',
    critical: true
  },
  
  // 核心JavaScript
  {
    url: '/static/js/main.js',
    type: 'script',
    priority: 'high',
    critical: true
  },
  
  // 应用图标
  {
    url: '/icons/icon-192.png',
    type: 'image',
    priority: 'high',
    critical: true
  },
  
  // 字体文件
  {
    url: '/static/media/font.woff2',
    type: 'font',
    priority: 'medium',
    critical: true,
    mimeType: 'font/woff2'
  }
];

/**
 * 次要资源配置
 */
export const SECONDARY_RESOURCES: PreloadResource[] = [
  // 卡牌图片
  {
    url: '/images/cards/placeholder.png',
    type: 'image',
    priority: 'medium',
    critical: false
  },
  
  // 音效文件
  {
    url: '/sounds/card-flip.mp3',
    type: 'audio',
    priority: 'low',
    critical: false
  },
  
  // 背景图片
  {
    url: '/images/background.jpg',
    type: 'image',
    priority: 'low',
    critical: false
  }
];

// ==================== 全局实例和工具函数 ====================

const globalPreloader = new ResourcePreloader();

/**
 * 预加载关键资源
 */
export async function preloadCriticalResources(): Promise<PreloadResult[]> {
  return globalPreloader.preloadResources(CRITICAL_RESOURCES, {
    maxConcurrent: 8,
    timeout: 15000,
    networkQualityThreshold: 'any',
    skipOnLowBattery: false // 关键资源不跳过
  });
}

/**
 * 预加载次要资源
 */
export async function preloadSecondaryResources(): Promise<PreloadResult[]> {
  return globalPreloader.preloadResources(SECONDARY_RESOURCES, {
    maxConcurrent: 4,
    timeout: 10000,
    networkQualityThreshold: 'fast',
    skipOnLowBattery: true
  });
}

/**
 * 智能预加载（根据网络和设备条件）
 */
export async function smartPreload(): Promise<void> {
  // 总是预加载关键资源
  await preloadCriticalResources();
  
  // 根据条件预加载次要资源
  const networkQuality = globalPreloader.getNetworkInfo();
  if (networkQuality && (globalPreloader.getBatteryInfo()?.level || 1) > 0.2) {
    // 延迟预加载次要资源
    setTimeout(() => {
      preloadSecondaryResources();
    }, 2000);
  }
}

// ==================== React Hook ====================

/**
 * 使用资源预加载的Hook
 */
export function useResourcePreloader() {
  const [isPreloading, setIsPreloading] = React.useState(false);
  const [preloadResults, setPreloadResults] = React.useState<PreloadResult[]>([]);
  const [cacheInfo, setCacheInfo] = React.useState(globalPreloader.getCacheInfo());
  
  React.useEffect(() => {
    // 定期更新缓存信息
    const interval = setInterval(() => {
      setCacheInfo(globalPreloader.getCacheInfo());
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  const preloadResource = React.useCallback(async (resource: PreloadResource, options?: PreloadOptions) => {
    setIsPreloading(true);
    try {
      const result = await globalPreloader.preloadResource(resource, options);
      setPreloadResults(prev => [...prev, result]);
      return result;
    } finally {
      setIsPreloading(false);
    }
  }, []);
  
  const preloadResources = React.useCallback(async (resources: PreloadResource[], options?: PreloadOptions) => {
    setIsPreloading(true);
    try {
      const results = await globalPreloader.preloadResources(resources, options);
      setPreloadResults(prev => [...prev, ...results]);
      return results;
    } finally {
      setIsPreloading(false);
    }
  }, []);
  
  const clearCache = React.useCallback(() => {
    globalPreloader.clearCache();
    setCacheInfo(globalPreloader.getCacheInfo());
  }, []);
  
  return {
    isPreloading,
    preloadResults,
    cacheInfo,
    preloadResource,
    preloadResources,
    clearCache,
    networkInfo: globalPreloader.getNetworkInfo(),
    batteryInfo: globalPreloader.getBatteryInfo()
  };
}

// ==================== 导出 ====================

export default globalPreloader;
export { ResourcePreloader };
export type {
  PreloadResource,
  PreloadOptions,
  PreloadResult,
  ResourceCache,
  NetworkInfo,
  ResourceType
};
