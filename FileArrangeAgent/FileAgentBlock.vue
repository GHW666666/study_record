<!--
  功能：调用文库完整block
  创建人：chenziqin01
  日期：2026-04-21
-->

<template>
    <div class="file-agent-block">
        <!-- 使用 AtomicAgenticThought 渲染 -->
        <widget-config-provider :config="widgetConfig">
            <div :class="isSingleAgent ? 'agent-thought-single' : 'agent-thought-multi'">
                <atomic-agentic-thought
                    :block-map="content"
                    :use-typer="!isHistory"
                    @widget-event="handleWidgetEvent"
                    @pipeline-complete="handlePipelineComplete"
                />
            </div>
        </widget-config-provider>
    </div>
</template>

<script lang="ts" setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import debounce from 'lodash/debounce';
import { WidgetConfigProvider } from '@baidu/atomic-components';
import * as ExecuteHybrid from '@chat/composables/hybridExecute';

import { aisearchAgentAck } from '@chat/api/search';
import { INode } from '@monorepo/nd-plugin-core/src/types';
import { useAgentFlowTimeLog } from '@chat/composables/useAgentFlowTimeLog';
import { TOOL_NAME, EStageType } from './fileAgentMap';
import { useChatCore } from '@chat/composables/useChatCore';

const { chatList } = useChatCore();


const props = defineProps<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any;
    stage: string;
    node: INode
    isSingleAgent?: boolean;
}>();

const isHistory = computed(() => props.node.chatData?.isHistory);
const query = String(props.node.chatData?.params?.query ?? '');
// blockMap 以 blockId 为 key，需按 type 匹配对应 stage 的 isEnd
const getStageIsEnd = (stage: string): boolean => {
    const data = (props.content as { data?: Record<string, { type?: string; isEnd?: boolean; content?: { results?: Array<{ type: string }> } }> } | undefined)?.data;
    if (!data) return false;
    // confirm_archive 阶段：以 organizePlan 出现作为"出整理方案卡"的结束标志，比 isEnd 更精确
    if (stage === EStageType.CONFIRM_ARCHIVE) {
        return Object.values(data).some(
            block => block.type === stage && block.content?.results?.some(r => r.type === 'organizePlan'),
        );
    }
    return Object.values(data).some(block => block.type === stage && block.isEnd);
};
const timeLog = useAgentFlowTimeLog(TOOL_NAME, props.isSingleAgent ? 'one': 'multi', query, () => props.stage, getStageIsEnd);

const emit = defineEmits<{
    'pipeline-complete': [];
    'user-action': []; // 用户执行操作后触发，用于隐藏收起状态下的操作区域
    'widget-event': [event: {
        source: string;
        action: string;
        payload?: unknown;
        event?: WidgetEvent;
    }];
    'confirmArchive':[event: WidgetEvent]
}>();


// Widget 事件参数类型
interface WidgetEventOption {
   // eslint-disable-next-line
    payload: any;
    title?: string;
    action :string;
    selectedItems?: Array<{ action: string }>;
}

interface WidgetEvent {
    source: string;
    arguments: WidgetEventOption[];
    widgetId: string;
    action: string;
}

// ==================== 事件处理器 ====================

const widgetConfig = {
    sourceLinkList: {
        collapsedCount: 2,
    },
    fileList: {
        collapsedCount: 3,
    },
    taskList: {
        block: 'full',
    },
};

const handlePipelineComplete = () => {
    emit('pipeline-complete');
};

/** 处理偏好确认事件 */
const handleOptionListConfirm = (event: WidgetEvent) => {
    emit('user-action'); // 通知父组件用户已执行操作
    if (event.payload?.selectedItems?.length) {
        // 3. clarify_card_confirm_time
        timeLog.onClarifyConfirm();
        // eslint-disable-next-line
        const actions: string[] = event.payload?.selectedItems.map((r: { action: string }) => r.action);
        aisearchAgentAck({
            ack: 1,
            // eslint-disable-next-line
            check_key: event.payload.widgetId,
            // eslint-disable-next-line
            check_value: JSON.stringify({ prefer: actions })
        });
    }
};

/** 处理整理方案确认事件 */
const handleOrganizaPlanConfirm = (event: WidgetEvent) => {
    emit('user-action'); // 通知父组件用户已执行操作
    timeLog.onGoConfirm();
    emit('confirmArchive', event);
    return;
    // aisearchAgentAck({
    //     ack: 1,
    //     check_key: event.widgetId,
    //     check_value: JSON.stringify({"confirm":1})
    // }).then(res=>{
    //   debugger;
    // })
};

function handleOrganizaPlanNavigation(event: WidgetEvent) {
    if (event.source === 'organizePlan') {
        emit('user-action'); // 通知父组件用户已执行操作
        // 7. user_go_confirm_zli_plan_time
        timeLog.onGoConfirm();
        emit('confirmArchive', event);
        return;
    }
}

/** 处理文件列表点击事件 */
const handleFileListClick = (event: WidgetEvent) => {
    // 搜索结果文件点击
    if (event.payload?.item) {
        timeLog.onSearchFileClk();
        ExecuteHybrid.hybridOpenFile({
          // eslint-disable-next-line
            fs_id: Number(event.payload.item.fileId),
            // eslint-disable-next-line
            path: event.payload.item.filePath,
        });
    }
};

const handleFileListViewAll = (event: WidgetEvent) => {
    timeLog.onSearchMoreClk();
    const query = curQuery.value ? encodeURIComponent(curQuery.value) : '';
    const chatList_queryid = chatList.value[chatList.value?.length - 1]?.chatData?.queryId || '';
    const queryId = props.node.chatData?.queryId || props.node.chatData?.params?.query_id || chatList_queryid;
    const param = `id=${event.payload.widgetId}&tool_id=${props.node.id}&query_id=${queryId}&dataSource=api`;
    const path = `https://pan.baidu.com/aipan/aichatpop/aiFileList?actionType=search&query=${query}&${param}`;
    ExecuteHybrid.screenAlertWebViewShow({
      url: path,
    });
};

const handleConfirm = (event: WidgetEvent) => {
    if (event.source === 'optionList') {
        handleOptionListConfirm(event);
    } else if (event.source === 'organizePlan') {
        handleOrganizaPlanConfirm(event);
    }
};

const handleChange = (event: WidgetEvent) => {
    if (event.source === 'optionList') {
        if (event.payload && event.payload.item) {
            if (event.payload.item.action === 'clean') {
                timeLog.onClarifyBtnChange('clean', event.payload.checked);
            }
            if (event.payload.item.action === 'classify') {
                timeLog.onClarifyBtnChange('classify', event.payload.checked);
            }
        }
    }
};
// ==================== 事件分发器 ====================

/** 防抖锁，防止重复触发 */
let isDebouncing = false;

/** 事件处理器映射表 */
type EventHandler = (event: WidgetEvent) => void;

interface EventHandlerMap {
    [action: string]: {
        [source: string]: EventHandler;
    };
}

const eventHandlerMap: EventHandlerMap = {
    confirm: handleConfirm,
    'item-click': handleFileListClick,
    'view-all': handleFileListViewAll,
    'to-file-list': handleOrganizaPlanNavigation,
    change: handleChange
};

/** 处理 Widget 事件 */
const handleWidgetEventOriginal = (event: WidgetEvent) => {
   emit('widget-event', {
      action: event.action,
      source: event.source,
      event: event,
    });
    isDebouncing = false;
    const handler = eventHandlerMap[event.action];
    if (handler) {
        handler(event);
    }
};

const handleWidgetEvent = debounce((event: WidgetEvent) => {
    if (isDebouncing) {
        return;
    }
    isDebouncing = true;
    handleWidgetEventOriginal(event);
}, 300);


const curQuery = ref('');

watch(
    () => props.node.chatData,
    (newVal: INode['chatData']) => {
        curQuery.value = newVal?.params?.query || '';
    },
    { immediate: true, deep: true }
);

onMounted(() => {
    // blockMap 为空（没有任何 block）时直接触发渲染完成
    if (!props.content?.orderedKeys?.length) {
        emit('pipeline-complete');
    }
});

onUnmounted(() => {
    handleWidgetEvent.cancel();
    isDebouncing = false;
});
</script>

<style lang="scss" scoped>
.file-agent-block {
    width: 100%;
}
.agent-thought-single {
    @import '@chat/components/Agent/Common/agentThought_single.scss';
}
.agent-thought-multi {
    @import '@chat/components/Agent/Common/agentThought_multi.scss';
}
:deep(.block_skill_block_confirm_archive){
    .skill-block-header {
        margin-bottom: 0 !important;
    }
}
:deep(.block_skill_block_execte_archive){
    .skill-block-header {
        margin-bottom: 0 !important;
    }
}
</style>
