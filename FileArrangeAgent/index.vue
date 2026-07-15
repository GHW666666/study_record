<!--
  功能：文件整理Agent V2 - 主容器组件（流式数据解析、子组件调度、思考状态管理）
  创建人：chenziqin01
  修改日期：2026-04-23
-->

<template>
    <AgentContainer
        ref="agentContainerRef"
        :title="AgentTitles[AgentType.FILE_ARRANGE]"
        :icon="AgentIcons[AgentType.FILE_ARRANGE]"
        :show-thinking="showThinking"
        :is-complete="isComplete"
        :is-paused="isPaused"
        :is-single-agent="isSingleAgent"
        :current-step-name="currentStepName"
        :default-expanded="defaultExpanded"
    >
        <div class="file-arrange-agent-content">
            <!-- 思考链区域：多 Agent 场景下可滚动 -->
            <div ref="thoughtRef" class="file-arrange-agent-content__thought">
                <FileAgentBlock
                    :content="blockMap"
                    :stage="latestStage"
                    :node="node"
                    :is-single-agent="isSingleAgent"
                    @pipeline-complete="onPipelineComplete"
                    @user-action="onUserAction"
                    @confirmArchive="handleConfirm"
                />
            </div>
            <!-- 结果小卡：多 Agent -->
            <div
                class="file-arrange-agent-content__result"
                v-if="treeSummaryNode"
            >
                <TreeSummary
                    ref="treeSummaryRef"
                    :node="treeSummaryNode as any"
                    @to-file-list="onToFileList"
                ></TreeSummary>
            </div>
            <div
                v-if="!isSingleAgent && !isComplete && !isHistory"
                class="agent-loading"
            ></div>
        </div>
        <!-- 收起状态下的操作按钮（多Agent场景，根据阶段动态显示） -->
        <template
            #collapsed-actions
            v-if="collapsedActions.length > 0"
        >
            <button
                v-for="action in collapsedActions"
                :key="action.key"
                class="collapsed-action-btn"
                :class="[`collapsed-action-btn--${action.type}`]"
                @click="onCollapsedActionClick()"
            >
                {{ action.label }}
            </button>
        </template>
    </AgentContainer>
</template>

<script lang="ts" setup>
import { computed, ref, watch, nextTick } from 'vue';
import { INode, ModelType } from '@monorepo/nd-plugin-core/src';
import AgentContainer from '../Common/AgentContainer.vue';
import { AgentType, AgentIcons, AgentTitles, AgentTypeBuryPoint } from '../config';
import { useAgentPipeline } from '../Common/useAgentPipeline';
import { useAutoScroll } from './composables/useAutoScroll';
import { useChatCore } from '@chat/composables/useChatCore';
import { getBlockType, getSummary, type IFrameContent, EStageType, TOOL_NAME } from './fileAgentMap';
import { useAgentFlowTimeLog } from '@chat/composables/useAgentFlowTimeLog';
import { getStageActions, type CollapsedAction } from './config';
import { handleShowToast, openOrganizePanel, aiChatStatusChange } from '@chat/composables/hybridExecute';
import { CompatBroadcastChannel, EChannelAction } from '@chat/composables/CompatBroadcastChannel';
import { emitter } from '@chat/utils/mitt';
import { useAgenticBurypoint } from '../Common/useAgenticBurypoint';
import { chatManageStore } from '@chat/stores/chatManage';
import { CHAT_STATUS_TO_NA } from '@chat/types/chat';

const { chatList } = useChatCore();


// ==================== 组件导入 ====================
import FileAgentBlock from './FileAgentBlock.vue';
import TreeSummary from '@chat/components/PanTools/TreeSummary/TreeSummary.vue';

const chatManageInstance = chatManageStore();
defineOptions({
    name: 'FileArrangeAgent',
});

const props = defineProps<{
    node: INode;
    renderEnd?:() => void;
}>();

// ====================  埋点 ====================
useAgenticBurypoint(AgentTypeBuryPoint.FILE_ARRANGE);

// ==================== 状态管理 ====================
// AgentContainer 组件引用
const agentContainerRef = ref<InstanceType<typeof AgentContainer> | null>(null);
const thoughtRef = ref<HTMLElement | null>(null);
// 传给 TreeSummary 的构造节点：将 v4 file_node_result 帧数据转换为 TreeSummary 能识别的 v2 消息格式
const treeSummaryNode = ref<Record<string, unknown> | null>(null);
/**
 * 用户已操作的 stage
 * 场景：用户点击确认按钮后，下一帧 SSE 数据返回较慢，此时用户收起面板，
 * 不应再展示该 stage 的收起操作按钮；但新 stage 进来时应重新展示
 */
const actionedStage = ref<string | null>(null);

// 记录用户是否已确认过整理方案，确认后再次打开弹层时传 ack: true
const isAcked = ref(false);
// 快照 confirm_archive 帧内容，后续点击复用，避免 SSE 继续推送或超时后参数漂移
const confirmedContent = ref<IFrameContent | null>(null);
const channel = new CompatBroadcastChannel<{ action: EChannelAction; data?: unknown }>('nd_aichat_app');
channel.onmessage(data => {
    if (data.action === EChannelAction.FILE_ARRANGE_ACK) {
        // 保存对话容器的滚动位置：弹窗 webview 关闭后，原生会将主 WebView 的滚动重置到顶部，
        // 因此在收到确认消息（早于 screenAlertWebViewClose 生效）时先记录位置，
        // 等关闭动画结束后再恢复。
        const chatContainer = document.getElementById('chatsWrapRoot');
        const savedScrollTop = chatContainer?.scrollTop ?? 0;
        isAcked.value = true;
        setTimeout(() => {
            const container = document.getElementById('chatsWrapRoot');
            if (container) {
                container.scrollTop = savedScrollTop;
            }
        }, 500);

        // 通知端：文件整理中，不可中止
        if (!props.node?.chatData?.isHistory) {
            aiChatStatusChange(
                CHAT_STATUS_TO_NA.NONTERMINABLE,
                isSimpleForNa.value,
                '文件整理中不支持中止',
                '文件整理中，不可中止'
            );
        }
    }
});

// modelType 为 SINGLE_AGENT(6) 时，isSimple 传 1
const isSimpleForNa = computed(() => {
    return props.node?.chatData?.modelType === ModelType.SINGLE_AGENT
        ? 1
        : (props.node?.chatData?.isSimple ? 1 : 0);
});

// ==================== 通用管线 ====================
const rawData = computed(() => props.node?.data || []);
const { frameList, isComplete, isPaused, isSingleAgent, onPipelineComplete, blockMap, errorMessage } = useAgentPipeline(
    rawData,
    {
        chatData: computed(() => props.node?.chatData),
        isDataEnd: computed(() => props.node?.isEnd === 1),
        onRenderEnd: () => props.renderEnd?.(),
    }
);
const timeLog = useAgentFlowTimeLog(
    TOOL_NAME,
    isSingleAgent.value ? 'one' : 'multi',
    String(props.node?.chatData?.params?.query ?? '')
);

// ==================== 自动滚动 ====================
// 仅任务完成后吸底：执行过程中不自动跟随，避免用户上滑查看整理方案时被拽回底部
useAutoScroll({ thoughtRef, agentContainerRef, isSingleAgent, isComplete });

// ==================== 计算属性 ====================
// 最新帧内容（传给 FileAgentBlock）
const latestContent = computed<IFrameContent | null>(() => {
    const lastFrame = frameList.value[frameList.value.length - 1];
    return lastFrame?.parsedContent || null;
});

// confirm_archive 帧到达时持续更新快照，确保拿到最终完整数据（含 tool_call_data 和 results）
watch(latestContent, content => {
    if (getBlockType(content) !== EStageType.CONFIRM_ARCHIVE) return;
    confirmedContent.value = content;
});

// 最新帧阶段
const latestStage = computed(() => getBlockType(latestContent.value));

// 是否显示思考状态
const showThinking = computed(() => frameList.value.length > 0);

// 是否历史消息，历史消息默认收起
const isHistory = computed(() => {
    const chatData = props.node?.chatData as { isHistory?: boolean } | undefined;
    return chatData?.isHistory === true;
});

// 默认是否展开：历史消息默认收起，否则展开
const defaultExpanded = computed(() => !isHistory.value);

// 当前子步骤名称
const currentStepName = computed(() => {
    if (!latestContent.value) return '';
    return getSummary(latestContent.value);
});

// 收起状态下显示的操作按钮（如果当前 stage 已被操作过则不显示）
const collapsedActions = computed<CollapsedAction[]>(() => {
    if (!latestStage.value) return [];
    // 当前 stage 已被用户操作过，不再显示操作按钮
    if (latestStage.value === actionedStage.value) return [];
    // confirm_archive 阶段需要额外判断：results 中存在 organizePlan 类型才展示
    if (latestStage.value === 'confirm_archive') {
        const results = latestContent.value?.tool_call_block?.content?.results as Array<{ type: string }> | undefined;
        if (!results?.some(r => r.type === 'organizePlan')) return [];
    }
    return getStageActions(latestStage.value);
});

// ==================== 事件处理 ====================

const getWidgetId = () => {
const results = confirmedContent.value?.tool_call_block?.content?.results as Array<{ widgetId: string; type: string }> | undefined;
    const id = results?.find(r => r.type === 'organizePlan')?.widgetId;
    if (id) return id;
    const confirmFrame = [...frameList.value].reverse().find(
        f => getBlockType(f.parsedContent) === EStageType.CONFIRM_ARCHIVE
    );
    const fallbackResults = confirmFrame?.parsedContent?.tool_call_block?.content?.results as Array<{ widgetId: string; type: string }> | undefined;
    return fallbackResults?.find(r => r.type === 'organizePlan')?.widgetId || '';
};

function handleConfirm() {
    const content = confirmedContent.value;
    // 确认整理方案

    // eslint-disable-next-line
    console.log('chatData===', props.node.chatData);
    const tree_tailts = getWidgetId();
    // 参考mine.ts取queryid
    const queryid = chatList.value[chatList.value?.length - 1]?.chatData?.queryId || '';
    const query_id = props.node.chatData?.queryId||
        props.node.chatData?.params?.query_id || queryid ||
        '';
    const message_id = props.node.chatData?.messageId ||
        props.node.chatData?.params?.message_id ||
        '';
    const query = props.node.chatData?.params?.query || '';
    const source = (chatManageInstance.querySource as string) || 'query';
    const archive_data = content?.tool_call_data?.businessData.archiveData;
    let type = 'all';
    // 只有一条数据时再进判断
    if (archive_data?.length === 1) {
        if (archive_data[0].type === 'clean_redundancy') {
            type = 'clean';
        } else {
            type = 'organize';
        }
    }
    const agent_model = isSingleAgent ? 'one' : 'multi';
    // 整理已执行完成时（execte_archive 阶段）、历史记录场景、或对话已结束但未确认时，ack 必须为 true，并且拦截不在跳转确认页
    const effectiveAck =
        isAcked.value ||
        isHistory.value ||
        latestContent.value?.tool_call_block?.type === 'execte_archive' ||
        isComplete.value;
    // eslint-disable-next-line
    console.log('拦截跳转===', {
        isAcked: isAcked.value,
        isHistory: isHistory.value,
        isComplete: isComplete.value,
        type: latestContent.value?.tool_call_block?.type === 'execte_archive',
    });
    if (isAcked.value) {
        handleShowToast('已确认方案，暂不支持查看');
        return;
    }
    if (effectiveAck) {
        handleShowToast('已失效');
        return;
    }
    // eslint-disable-next-line
    console.log(
        '跳转参数',
        JSON.stringify({
            widget_id: tree_tailts,
            tree_tool_id: 'wangpan_agent_filearrange',
            tree_query_id: query_id,
            message_id,
            ack: effectiveAck,
            query,
            agent_model,
            source,
        })
    );
    const wappopupParms = encodeURIComponent(
        JSON.stringify({
            widget_id: tree_tailts,
            tree_tool_id: 'wangpan_agent_filearrange',
            message_id: message_id,
            tree_query_id: query_id,
            ack: effectiveAck,
            query,
            agent_model: 'one',
            source,
        })
    );
    const debugUrl = `/aipan/aichatpop/fileAgentPlan?wappopupParms=${wappopupParms}`;
    // eslint-disable-next-line
    console.log('[FileArrangeAgent] Debug URL:', debugUrl);

    // 调用 organize_panel/open 协议打开整理方案面板
    openOrganizePanel({
        type,
        widget_id: tree_tailts,
        tree_tool_id: 'wangpan_agent_filearrange',
        tree_query_id: query_id,
        message_id,
        ack: effectiveAck,
        query,
        agent_model,
        source,
    });
}

// 收起状态下点击操作按钮
function onCollapsedActionClick() {
    // 展开面板
    agentContainerRef.value?.expand();
    // 等待 DOM 更新后滚动到对应 block（双 nextTick 确保子组件渲染完成）
    nextTick(() => {
        nextTick(() => {
            agentContainerRef.value?.scrollToBlock(latestStage.value);
        });
    });
}
/** 去文件列表查看按钮点击 */
function onToFileList() {
    timeLog.onToFileListClk();
}

/** 用户执行操作后记录当前 stage，隐藏该 stage 的收起操作按钮 */
function onUserAction() {
    actionedStage.value = latestStage.value;
}

// ==================== stage 切换滚动 ====================
/**
 * 监听数据变化，新 stage 出现时滚动到对应 block 顶部
 */
watch(
    () => props.node?.data?.length ?? 0,
    len => {
        if (len > 0) {
            nextTick(() => {
                nextTick(() => {
                    agentContainerRef.value?.scrollToBlock(latestStage.value);
                });
            });
        }
    },
    { flush: 'post' }
);

// 监听 tree_files 帧，更新结果区域，并将 v4 数据转换为 TreeSummary 的 v2 node 格式
watch(latestContent, content => {
    const raw = content as unknown as Record<string, unknown>;
    if (raw?.type === 'tree_files') {
        // 构造符合 TreeSummary extractContent 逻辑的 node 对象：
        // data 里放一条消息，content[0].type === 'file_list'，text.value 为 JSON 字符串
        treeSummaryNode.value = {
            chatData: props.node.chatData,
            data: [
                {
                    content: [
                        {
                            type: 'file_list',
                            text: {
                                value: JSON.stringify({
                                    type: raw.type,
                                    tailts: raw.tailts,
                                    file_source: raw.file_source,
                                    summary: raw.summary,
                                    file_nodes: raw.file_nodes,
                                }),
                            },
                        },
                    ],
                    is_end: true,
                    thought_type: 'file_node_result',
                    content_type: 'file_node_result',
                    tool_name: 'wangpan_agent_filearrange',
                },
            ],
        };
    }
});

// ==================== Agent 运行状态上报 ====================
watch(
    () => ({
        hasData: (props.node?.data?.length ?? 0) > 0,
        isComplete: isComplete.value,
        isPaused: isPaused.value,
    }),
    (cur, prev) => {
        const agentId = props.node?.id;
        if (agentId === undefined || agentId === null) {
            return;
        }
        if (isSingleAgent.value) {
            return;
        }
        const running = cur.hasData && !cur.isComplete && !cur.isPaused;
        const prevRunning = prev ? prev.hasData && !prev.isComplete && !prev.isPaused : undefined;
        if (running !== prevRunning) {
            emitter.emit('agentStatusChange', {
                agentId,
                status: running,
            });
        }
    },
    { immediate: true }
);

watch(
    () => errorMessage.value,
    val => {
        if (!val) return;
        emitter.emit('agentError');
    },
    { immediate: true }
);
</script>

<style lang="scss" scoped>
.file-arrange-agent-content {
    // display: flex;
    // flex-direction: column;
    height: auto;

    // 思考链区域：占据剩余空间，可滚动
    &__thought {
        // flex: 1;
        min-height: 0;
        overflow-y: auto;
    }

    // 结果小卡：固定在底部
    &__result {
        // flex-shrink: 0;
        margin-top: 12px;
    }
}

.collapsed-action-btn {
    width: 100%;
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 500;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s ease;
    color: #fff;
    background: #1a1a1a;

    &:hover {
        background: #333;
    }

    &:active {
        background: #000;
    }

    & + & {
        margin-top: 8px;
    }
}
:deep(.atomic-mini-result-card--compact) {
    padding: var(--atomic-space-sm) var(--atomic-space-xs) !important;
    box-sizing: border-box !important;
    width: 100% !important;
}

.agent-loading {
    width: 20px;
    height: 20px;
    margin-top: 10px;
    background-image: url(https://staticsns.cdn.bcebos.com/amis/2026-5/1778489268027/%E8%83%8C%E6%99%AF%20%E8%93%9D%E8%89%B2.png);
    background-size: cover;
}
</style>
