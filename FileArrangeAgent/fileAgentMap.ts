/**
 * 文件整理 Agent 组件映射配置
 * 特定于 FileArrangeAgent 的配置，公共类型和函数从 Common/agentTypes 导入
 */

import {
    createComponentResolver,
    parseContentJson,
    getBlockType,
    getBlockId,
    getSummary,
    getWidgets,
    isBlockEnd,
    type IFrameContent,
    type IToolIdentifier,
    type IWidget,
    type ITextWidget,
    type IOptionListWidget,
    type ITaskListWidget,
    type IFileListWidget,
    type IProgressWidget,
    type IOrganizaPlanWidget,
    type WidgetTypes,
} from '../Common/agentTypes';

// 工具名称
export const TOOL_NAME = 'gf--wangpan_agent_filearrange';

// ============ Stage 类型枚举 ============

export enum EStageType {
    SELECT_PREFER = 'select_prefer', // 选择整理偏好
    SEARCH = 'search', // 搜索文件
    ANALYSIS_FOLDER_LIST = 'analysis_folder_list', // 分析文件夹列表
    SCAN_FOLDER = 'scan_folder', // 扫描文件夹
    VIEW_FOLDER = 'view_folder', // 查看文件夹
    RECOGNIZE_FILE_DETAIL = 'recognize_file_detail', // 识别文件详情
    RECOGNIZE_REDUNDANCY = 'recognize_redundancy', // 识别冗余文件
    CONFIRM_ARCHIVE = 'confirm_archive', // 确认整理方案
    EXECUTE_ARCHIVE = 'execte_archive', // 执行整理（注意：接口拼写为 execte）
}

// ============ 组件枚举 ============
export enum EStreamComponent {
    SELECT_PREFER = 'SelectPrefer', // 选择整理偏好
    SEARCH = 'Search', // 搜索文件
    ANALYSIS_FOLDER_LIST = 'AnalysisFolderList', // 分析文件夹列表
    SCAN_FOLDER = 'ScanFolder', // 扫描文件夹
    VIEW_FOLDER = 'ViewFolder', // 查看文件夹
    RECOGNIZE_FILE_DETAIL = 'RecognizeFileDetail', // 识别文件详情
    RECOGNIZE_REDUNDANCY = 'RecognizeRedundancy', // 识别冗余文件
    CONFIRM_ARCHIVE = 'ConfirmArchive', // 确认整理方案
    EXECUTE_ARCHIVE = 'ExecuteArchive', // 执行整理
}

// ============ 组件映射表 ============

/**
 * 文件整理 Agent 组件映射
 * key: tool_call_block.type (即 Stage 类型)
 * value: 组件枚举
 */
export const componentMap: Record<string, EStreamComponent> = {
    [EStageType.SELECT_PREFER]: EStreamComponent.SELECT_PREFER,
    [EStageType.SEARCH]: EStreamComponent.SEARCH,
    [EStageType.ANALYSIS_FOLDER_LIST]: EStreamComponent.ANALYSIS_FOLDER_LIST,
    [EStageType.SCAN_FOLDER]: EStreamComponent.SCAN_FOLDER,
    [EStageType.VIEW_FOLDER]: EStreamComponent.VIEW_FOLDER,
    [EStageType.RECOGNIZE_FILE_DETAIL]: EStreamComponent.RECOGNIZE_FILE_DETAIL,
    [EStageType.RECOGNIZE_REDUNDANCY]: EStreamComponent.RECOGNIZE_REDUNDANCY,
    [EStageType.CONFIRM_ARCHIVE]: EStreamComponent.CONFIRM_ARCHIVE,
    [EStageType.EXECUTE_ARCHIVE]: EStreamComponent.EXECUTE_ARCHIVE,
};

// 创建组件解析器
export const resolveStreamComponent = createComponentResolver(TOOL_NAME, componentMap);

// ============ 重新导出公共类型和函数 ============

export {
    parseContentJson,
    getBlockType,
    getBlockId,
    getSummary,
    getWidgets,
    isBlockEnd,
    type IFrameContent,
    type IToolIdentifier,
    type IWidget,
    type ITextWidget,
    type IOptionListWidget,
    type ITaskListWidget,
    type IFileListWidget,
    type IProgressWidget,
    type IOrganizaPlanWidget,
    type WidgetTypes,
};

// ============ 类型导出 ============

export type StageType = keyof typeof componentMap;
