/**
 * 懒加载图片组件
 * 支持图片懒加载、占位符和错误处理
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ==================== 类型定义 ====================

interface LazyImageProps {
  /** 图片源地址 */
  src: string;
  /** 备用图片地址 */
  fallbackSrc?: string;
  /** 图片描述 */
  alt: string;
  /** CSS类名 */
  className?: string;
  /** 样式 */
  style?: React.CSSProperties;
  /** 占位符组件 */
  placeholder?: React.ReactNode;
  /** 加载错误时的占位符 */
  errorPlaceholder?: React.ReactNode;
  /** 是否立即加载（跳过懒加载） */
  eager?: boolean;
  /** 根边距（用于提前触发加载） */
  rootMargin?: string;
  /** 加载完成回调 */
  onLoad?: () => void;
  /** 加载错误回调 */
  onError?: (error: string) => void;
  /** 点击事件 */
  onClick?: () => void;
}

interface ImageState {
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否加载完成 */
  isLoaded: boolean;
  /** 是否加载错误 */
  hasError: boolean;
  /** 错误信息 */
  error: string | null;
  /** 是否在视口中 */
  isInView: boolean;
}

// ==================== 工具函数 ====================

/**
 * 创建Intersection Observer
 */
function createIntersectionObserver(
  callback: (isInView: boolean) => void,
  rootMargin: string = '50px'
): IntersectionObserver | null {
  if (typeof window === 'undefined' || !window.IntersectionObserver) {
    return null;
  }
  
  return new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        callback(entry.isIntersecting);
      });
    },
    {
      rootMargin,
      threshold: 0.1
    }
  );
}

/**
 * 预加载图片
 */
function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

// ==================== 默认占位符组件 ====================

const DefaultPlaceholder: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-gray-200 animate-pulse flex items-center justify-center ${className}`}>
    <svg 
      className="w-8 h-8 text-gray-400" 
      fill="currentColor" 
      viewBox="0 0 20 20"
    >
      <path 
        fillRule="evenodd" 
        d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" 
        clipRule="evenodd" 
      />
    </svg>
  </div>
);

const DefaultErrorPlaceholder: React.FC<{ className?: string; error?: string }> = ({ 
  className = '', 
  error 
}) => (
  <div className={`bg-red-50 border border-red-200 flex items-center justify-center ${className}`}>
    <div className="text-center p-4">
      <svg 
        className="w-8 h-8 text-red-400 mx-auto mb-2" 
        fill="currentColor" 
        viewBox="0 0 20 20"
      >
        <path 
          fillRule="evenodd" 
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" 
          clipRule="evenodd" 
        />
      </svg>
      <p className="text-red-600 text-xs">图片加载失败</p>
      {error && (
        <p className="text-red-500 text-xs mt-1 opacity-75">{error}</p>
      )}
    </div>
  </div>
);

// ==================== 主组件 ====================

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  fallbackSrc,
  alt,
  className = '',
  style,
  placeholder,
  errorPlaceholder,
  eager = false,
  rootMargin = '50px',
  onLoad,
  onError,
  onClick
}) => {
  const [state, setState] = useState<ImageState>({
    isLoading: false,
    isLoaded: false,
    hasError: false,
    error: null,
    isInView: eager // 如果是eager模式，直接设为在视口中
  });
  
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  // 加载图片
  const loadImage = useCallback(async (imageSrc: string) => {
    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      hasError: false, 
      error: null 
    }));
    
    try {
      await preloadImage(imageSrc);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        isLoaded: true,
        hasError: false
      }));
      
      onLoad?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // 如果有备用图片且当前不是备用图片，尝试加载备用图片
      if (fallbackSrc && imageSrc !== fallbackSrc) {
        try {
          await preloadImage(fallbackSrc);
          setState(prev => ({
            ...prev,
            isLoading: false,
            isLoaded: true,
            hasError: false
          }));
          onLoad?.();
          return;
        } catch (fallbackError) {
          // 备用图片也失败了
        }
      }
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        isLoaded: false,
        hasError: true,
        error: errorMessage
      }));
      
      onError?.(errorMessage);
    }
  }, [fallbackSrc, onLoad, onError]);
  
  // 设置Intersection Observer
  useEffect(() => {
    if (eager || state.isLoaded) {
      return;
    }
    
    const container = containerRef.current;
    if (!container) return;
    
    observerRef.current = createIntersectionObserver(
      (isInView) => {
        setState(prev => ({ ...prev, isInView }));
      },
      rootMargin
    );
    
    if (observerRef.current) {
      observerRef.current.observe(container);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [eager, state.isLoaded, rootMargin]);
  
  // 当图片进入视口时开始加载
  useEffect(() => {
    if ((state.isInView || eager) && !state.isLoaded && !state.isLoading && !state.hasError) {
      loadImage(src);
    }
  }, [state.isInView, eager, state.isLoaded, state.isLoading, state.hasError, src, loadImage]);
  
  // 当src改变时重置状态
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isLoaded: false,
      hasError: false,
      error: null,
      isInView: eager
    }));
  }, [src, eager]);
  
  // 渲染占位符
  const renderPlaceholder = () => {
    if (state.hasError) {
      return errorPlaceholder || <DefaultErrorPlaceholder className={className} error={state.error || undefined} />;
    }
    
    if (state.isLoading || (!state.isLoaded && (state.isInView || eager))) {
      return placeholder || <DefaultPlaceholder className={className} />;
    }
    
    // 还未进入视口时的占位符
    return placeholder || <DefaultPlaceholder className={className} />;
  };
  
  // 获取实际要显示的图片源
  const getImageSrc = () => {
    if (state.hasError && fallbackSrc) {
      return fallbackSrc;
    }
    return src;
  };
  
  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
      style={style}
      onClick={onClick}
    >
      {/* 占位符 */}
      {!state.isLoaded && renderPlaceholder()}
      
      {/* 实际图片 */}
      {(state.isInView || eager) && (
        <img
          ref={imgRef}
          src={getImageSrc()}
          alt={alt}
          className={`transition-opacity duration-300 ${
            state.isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          style={{
            position: state.isLoaded ? 'static' : 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          onLoad={() => {
            setState(prev => ({
              ...prev,
              isLoading: false,
              isLoaded: true,
              hasError: false
            }));
          }}
          onError={() => {
            const errorMessage = `Failed to load image: ${getImageSrc()}`;
            setState(prev => ({
              ...prev,
              isLoading: false,
              isLoaded: false,
              hasError: true,
              error: errorMessage
            }));
            onError?.(errorMessage);
          }}
        />
      )}
      
      {/* 加载指示器 */}
      {state.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  );
};

// ==================== 批量图片预加载Hook ====================

export function useImagePreloader(urls: string[]) {
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  
  const preloadImages = useCallback(async (imageUrls: string[]) => {
    if (imageUrls.length === 0) return;
    
    setIsPreloading(true);
    setPreloadProgress(0);
    
    const results = await Promise.allSettled(
      imageUrls.map(async (url, index) => {
        try {
          await preloadImage(url);
          setPreloadedImages(prev => new Set([...prev, url]));
          setPreloadProgress((index + 1) / imageUrls.length * 100);
          return url;
        } catch (error) {
          console.warn(`Failed to preload image: ${url}`, error);
          setPreloadProgress((index + 1) / imageUrls.length * 100);
          throw error;
        }
      })
    );
    
    setIsPreloading(false);
    
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;
    
    return { successful, failed, total: imageUrls.length };
  }, []);
  
  useEffect(() => {
    if (urls.length > 0) {
      const unpreloadedUrls = urls.filter(url => !preloadedImages.has(url));
      if (unpreloadedUrls.length > 0) {
        preloadImages(unpreloadedUrls);
      }
    }
  }, [urls, preloadedImages, preloadImages]);
  
  return {
    preloadedImages,
    isPreloading,
    preloadProgress,
    preloadImages
  };
}

export default LazyImage;