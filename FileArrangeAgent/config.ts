/**
 * 文件整理 Agent 配置
 * 包含阶段-操作按钮映射等
 */

import { EStageType } from './fileAgentMap';

// 操作按钮类型
export interface CollapsedAction {
    /** 唯一标识，用于事件处理 */
    key: string;
    /** 按钮文案 */
    label: string;
    /** 按钮类型 */
    type: 'primary' | 'default';
}

// 阶段对应的操作按钮配置
export const StageActionsMap: Record<string, CollapsedAction[]> = {
    // 确认整理方案阶段 - 显示确认和取消按钮
    [EStageType.SELECT_PREFER]: [
        { key: 'confirm', label: '选择整理偏好', type: 'primary' },
    ],
    [EStageType.CONFIRM_ARCHIVE]: [
        { key: 'confirm', label: '确认方案', type: 'primary' },
    ],
};

/**
 * 根据阶段获取操作按钮配置
 */
export function getStageActions(stageType: string): CollapsedAction[] {
    return StageActionsMap[stageType] || [];
}
