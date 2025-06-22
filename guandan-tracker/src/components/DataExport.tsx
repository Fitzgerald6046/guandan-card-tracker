/**
 * 数据导出组件
 * 支持游戏数据导出为JSON、CSV等格式
 */

import React, { useState, useCallback } from 'react';
import type { ExportOptions } from '../hooks/useGameHistory';
import type { GameRank } from '../types/game';
import { getRankName } from '../utils/rankUtils';

// ==================== 类型定义 ====================

interface DataExportProps {
  /** 导出函数 */
  onExport: (options: ExportOptions) => string;
  /** 导入函数 */
  onImport: (data: string) => boolean;
  /** 可用的级数选项 */
  availableRanks: GameRank[];
  /** 游戏记录总数 */
  totalGames: number;
}

interface ExportPreview {
  estimatedSize: string;
  recordCount: number;
  dateRange: string;
  formats: string[];
}

// ==================== 工具函数 ====================

/**
 * 估算导出文件大小
 */
function estimateFileSize(recordCount: number, includeAnalysis: boolean, includeCards: boolean): string {
  let baseSize = recordCount * 2; // 每条记录基础2KB
  
  if (includeAnalysis) {
    baseSize += recordCount * 5; // 分析报告增加5KB
  }
  
  if (includeCards) {
    baseSize += recordCount * 3; // 卡牌数据增加3KB
  }
  
  if (baseSize < 1024) {
    return `${baseSize}KB`;
  } else {
    return `${(baseSize / 1024).toFixed(1)}MB`;
  }
}

/**
 * 格式化日期范围
 */
function formatDateRange(start: number, end: number): string {
  const startDate = new Date(start).toLocaleDateString('zh-CN');
  const endDate = new Date(end).toLocaleDateString('zh-CN');
  return `${startDate} - ${endDate}`;
}

/**
 * 下载文件
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==================== 组件定义 ====================

export const DataExport: React.FC<DataExportProps> = ({
  onExport,
  onImport,
  availableRanks,
  totalGames
}) => {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'json',
    includeData: {
      gameRecords: true,
      analysisReports: true,
      statistics: true,
      cardData: false
    }
  });
  
  const [dateRange, setDateRange] = useState<{
    enabled: boolean;
    start: string;
    end: string;
  }>({
    enabled: false,
    start: '',
    end: ''
  });
  
  const [rankFilter, setRankFilter] = useState<{
    enabled: boolean;
    selectedRanks: GameRank[];
  }>({
    enabled: false,
    selectedRanks: []
  });
  
  const [importData, setImportData] = useState<string>('');
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  
  // 计算导出预览
  const exportPreview: ExportPreview = {
    estimatedSize: estimateFileSize(
      totalGames,
      exportOptions.includeData.analysisReports,
      exportOptions.includeData.cardData
    ),
    recordCount: totalGames,
    dateRange: dateRange.enabled && dateRange.start && dateRange.end
      ? formatDateRange(new Date(dateRange.start).getTime(), new Date(dateRange.end).getTime())
      : '全部时间',
    formats: [exportOptions.format.toUpperCase()]
  };
  
  // 处理导出
  const handleExport = useCallback(() => {
    try {
      const options: ExportOptions = {
        ...exportOptions,
        dateRange: dateRange.enabled && dateRange.start && dateRange.end ? {
          start: new Date(dateRange.start).getTime(),
          end: new Date(dateRange.end).getTime()
        } : undefined,
        rankFilter: rankFilter.enabled && rankFilter.selectedRanks.length > 0
          ? rankFilter.selectedRanks
          : undefined
      };
      
      const exportedData = onExport(options);
      
      // 生成文件名
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `guandan_data_${timestamp}.${options.format}`;
      
      // 确定MIME类型
      const mimeType = options.format === 'json' ? 'application/json' :
                      options.format === 'csv' ? 'text/csv' : 'text/plain';
      
      // 下载文件
      downloadFile(exportedData, filename, mimeType);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败，请重试');
    }
  }, [exportOptions, dateRange, rankFilter, onExport]);
  
  // 处理导入
  const handleImport = useCallback(() => {
    if (!importData.trim()) {
      setImportStatus({ type: 'error', message: '请输入要导入的数据' });
      return;
    }
    
    try {
      const success = onImport(importData);
      if (success) {
        setImportStatus({ type: 'success', message: '导入成功！' });
        setImportData('');
      } else {
        setImportStatus({ type: 'error', message: '导入失败，数据格式不正确' });
      }
    } catch (error) {
      setImportStatus({ type: 'error', message: '导入失败，请检查数据格式' });
    }
  }, [importData, onImport]);
  
  // 处理文件上传
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportData(content);
    };
    reader.readAsText(file);
  }, []);
  
  return (
    <div className="data-export bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">数据管理</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 数据导出 */}
        <div className="export-section">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">数据导出</h3>
          
          {/* 导出格式 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              导出格式
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['json', 'csv', 'txt'] as const).map(format => (
                <label key={format} className="flex items-center">
                  <input
                    type="radio"
                    name="format"
                    value={format}
                    checked={exportOptions.format === format}
                    onChange={(e) => setExportOptions(prev => ({
                      ...prev,
                      format: e.target.value as 'json' | 'csv' | 'txt'
                    }))}
                    className="mr-2"
                  />
                  <span className="text-sm">{format.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* 包含数据 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              包含数据
            </label>
            <div className="space-y-2">
              {Object.entries({
                gameRecords: '游戏记录',
                analysisReports: '分析报告',
                statistics: '统计信息',
                cardData: '卡牌数据'
              }).map(([key, label]) => (
                <label key={key} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeData[key as keyof typeof exportOptions.includeData]}
                    onChange={(e) => setExportOptions(prev => ({
                      ...prev,
                      includeData: {
                        ...prev.includeData,
                        [key]: e.target.checked
                      }
                    }))}
                    className="mr-2"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* 日期范围过滤 */}
          <div className="mb-4">
            <label className="flex items-center mb-2">
              <input
                type="checkbox"
                checked={dateRange.enabled}
                onChange={(e) => setDateRange(prev => ({
                  ...prev,
                  enabled: e.target.checked
                }))}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">日期范围过滤</span>
            </label>
            
            {dateRange.enabled && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({
                    ...prev,
                    start: e.target.value
                  }))}
                  className="text-xs border border-gray-300 rounded px-2 py-1"
                  placeholder="开始日期"
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({
                    ...prev,
                    end: e.target.value
                  }))}
                  className="text-xs border border-gray-300 rounded px-2 py-1"
                  placeholder="结束日期"
                />
              </div>
            )}
          </div>
          
          {/* 级数过滤 */}
          <div className="mb-4">
            <label className="flex items-center mb-2">
              <input
                type="checkbox"
                checked={rankFilter.enabled}
                onChange={(e) => setRankFilter(prev => ({
                  ...prev,
                  enabled: e.target.checked
                }))}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">级数过滤</span>
            </label>
            
            {rankFilter.enabled && (
              <div className="grid grid-cols-4 gap-1">
                {availableRanks.map(rank => (
                  <label key={rank} className="flex items-center text-xs">
                    <input
                      type="checkbox"
                      checked={rankFilter.selectedRanks.includes(rank)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRankFilter(prev => ({
                            ...prev,
                            selectedRanks: [...prev.selectedRanks, rank]
                          }));
                        } else {
                          setRankFilter(prev => ({
                            ...prev,
                            selectedRanks: prev.selectedRanks.filter(r => r !== rank)
                          }));
                        }
                      }}
                      className="mr-1"
                    />
                    <span>{getRankName(rank)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          
          {/* 导出预览 */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <h4 className="text-sm font-medium text-gray-800 mb-2">导出预览</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <p>记录数量: {exportPreview.recordCount}</p>
              <p>日期范围: {exportPreview.dateRange}</p>
              <p>预估大小: {exportPreview.estimatedSize}</p>
              <p>格式: {exportPreview.formats.join(', ')}</p>
            </div>
          </div>
          
          {/* 导出按钮 */}
          <button
            onClick={handleExport}
            disabled={totalGames === 0}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {totalGames === 0 ? '暂无数据可导出' : '导出数据'}
          </button>
        </div>
        
        {/* 数据导入 */}
        <div className="import-section">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">数据导入</h3>
          
          {/* 文件上传 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择文件
            </label>
            <input
              type="file"
              accept=".json,.txt"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          
          {/* 手动输入 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              或手动粘贴数据
            </label>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="粘贴JSON格式的游戏数据..."
              className="w-full h-32 text-xs border border-gray-300 rounded-lg px-3 py-2 resize-none"
            />
          </div>
          
          {/* 导入状态 */}
          {importStatus.type && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              importStatus.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {importStatus.message}
            </div>
          )}
          
          {/* 导入按钮 */}
          <button
            onClick={handleImport}
            disabled={!importData.trim()}
            className="w-full bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            导入数据
          </button>
          
          {/* 导入说明 */}
          <div className="mt-4 text-xs text-gray-500 space-y-1">
            <p>• 支持JSON格式的游戏数据</p>
            <p>• 导入会自动过滤重复记录</p>
            <p>• 最多保留10条最新记录</p>
            <p>• 导入前建议先备份现有数据</p>
          </div>
        </div>
      </div>
      
      {/* 数据管理操作 */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">快捷操作</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => {
              setExportOptions({
                format: 'json',
                includeData: {
                  gameRecords: true,
                  analysisReports: true,
                  statistics: true,
                  cardData: true
                }
              });
              handleExport();
            }}
            className="bg-purple-500 text-white py-2 px-3 rounded-lg hover:bg-purple-600 transition-colors text-sm"
          >
            完整备份
          </button>
          
          <button
            onClick={() => {
              setExportOptions({
                format: 'csv',
                includeData: {
                  gameRecords: true,
                  analysisReports: false,
                  statistics: true,
                  cardData: false
                }
              });
              handleExport();
            }}
            className="bg-orange-500 text-white py-2 px-3 rounded-lg hover:bg-orange-600 transition-colors text-sm"
          >
            导出统计
          </button>
          
          <button
            onClick={() => {
              if (confirm('确定要清空所有导入/导出设置吗？')) {
                setExportOptions({
                  format: 'json',
                  includeData: {
                    gameRecords: true,
                    analysisReports: true,
                    statistics: true,
                    cardData: false
                  }
                });
                setDateRange({ enabled: false, start: '', end: '' });
                setRankFilter({ enabled: false, selectedRanks: [] });
                setImportData('');
                setImportStatus({ type: null, message: '' });
              }
            }}
            className="bg-gray-500 text-white py-2 px-3 rounded-lg hover:bg-gray-600 transition-colors text-sm"
          >
            重置设置
          </button>
          
          <button
            onClick={() => {
              const helpText = `
数据导出说明：
1. JSON: 完整数据，包含所有信息
2. CSV: 表格格式，适合Excel分析
3. TXT: 纯文本格式，便于查看

导入说明：
- 只接受本应用导出的JSON格式
- 会自动去重，保留最新记录
- 最多保存10条历史记录
              `.trim();
              alert(helpText);
            }}
            className="bg-blue-500 text-white py-2 px-3 rounded-lg hover:bg-blue-600 transition-colors text-sm"
          >
            使用帮助
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataExport;