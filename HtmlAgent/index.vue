<template>
    <div
        :class="containerClassName"
        ref="htmlAgentRef"
    >
        <AgentContainer
            :title="toolShowName || AgentTitles[AgentType.HTML_GEN]"
            :icon="AgentIcons[AgentType.HTML_GEN]"
            :show-thinking="showThinking"
            :is-complete="isComplete"
            :is-paused="isPaused"
            :is-single-agent="isSingleAgent"
            :error-message="errorMessage"
            :current-step-name="currentStepName"
            ref="agentContainerRef"
        >
            <div class="code-agent-content">
                <!-- 思考链区域：多 Agent 场景下可滚动 -->
                <div class="code-agent-content__thought">
                    <div
                        v-for="frame in frameArrData"
                        :key="frame.id"
                    >
                        <HtmlAgentThought
                            v-if="frame?.blockContent?.type === 'common_thought'"
                            :content="frame.blockMap"
                            :is-history="isHistory"
                            :is-single-agent="isSingleAgent"
                            @pipeline-complete="onPipelineComplete"
                        />
                        <SvgAtomicMarkdown
                            v-else-if="frame?.codeContent?.codeLang === 'svg'"
                            :frame-data="frame"
                            :on-pipeline-complete="onPipelineComplete"
                            :latest-stage="latestStage"
                            :is-complete="isComplete"
                            :is-history="isHistory"
                        />
                        <MermaidAtomicMarkdown
                            v-else-if="frame?.codeContent?.codeLang === 'mermaid'"
                            :frame-data="frame"
                            :on-pipeline-complete="onPipelineComplete"
                            :latest-stage="latestStage"
                            :is-complete="isComplete"
                            :is-history="isHistory"
                        />
                        <CodeAtomicMarkdown
                            v-else
                            :frame-data="frame"
                            :file-data="resultFileList"
                            :on-pipeline-complete="onPipelineComplete"
                            :latest-stage="latestStage"
                            :is-complete="isComplete"
                            :is-history="isHistory"
                        />
                    </div>
                </div>
                <div
                    class="code-agent-content__result"
                    v-if="resultFileList.length > 0"
                    :style="{ marginTop: resultCardType === 'small' ? '8px' : '' }"
                >
                    <HtmlMultiTypeResultCard
                        :content="resultFileList"
                        :card-type="resultCardType"
                    />
                </div>
                <div
                    v-if="!isSingleAgent && !isComplete && !isHistory"
                    class="agent-loading"
                ></div>
            </div>
        </AgentContainer>
    </div>
</template>

<script lang="ts">
interface Props {
    node: INode;
    renderEnd?: () => void;
}
</script>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { INode } from '@monorepo/nd-plugin-core/src';
import AgentContainer from '@chat/components/Agent/Common/AgentContainer.vue';
import { AgentType, AgentIcons, AgentTitles, AgentTypeBuryPoint } from '../config';
import { useAgentPipeline, getSummary } from '@chat/components/Agent/Common';
import type { IAgentFrame } from '@chat/components/Agent/Common';
import HtmlAgentThought from './components/HtmlAgentThought.vue';
import HtmlMultiTypeResultCard from './components/HtmlMultiTypeResultCard.vue';
import CodeAtomicMarkdown from './components/CodeAtomicMarkdown.vue';
import MermaidAtomicMarkdown from './components/MermaidAtomicMarkdown.vue';
import SvgAtomicMarkdown from './components/SvgAtomicMarkdown.vue';
import { AgentFileResultTypes } from '@chat/components/Agent/HtmlAgent/types';
import { safeJsonParse } from '@chat/utils/common';
import { emitter } from '@chat/utils/mitt';
import { useAgenticBurypoint } from '../Common/useAgenticBurypoint';

defineOptions({
    name: 'HtmlAgent',
});

/** 统一结果卡类型 */
const resultCardType = computed<'large' | 'small'>(() => {
    if (isSingleAgent.value) {
        return 'large';
    }
    return 'small';
});

const props = defineProps<Props>();

useAgenticBurypoint(AgentTypeBuryPoint.HTML);

const rawData = computed(() => props.node?.data || []);
const isHistory = computed(() => props.node?.chatData?.isHistory || false);

const {
    frameList,
    frameListBlockMap,
    resultFileIds,
    toolShowName,
    errorMessage,
    isComplete,
    isPaused,
    isSingleAgent,
    onPipelineComplete,
    latestStage,
} = useAgentPipeline(rawData, {
    chatData: computed(() => props.node?.chatData),
    isDataEnd: computed(() => props.node?.isEnd === 1),
    onRenderEnd: () => props.renderEnd?.(),
});

const containerClassName = computed<string>(() => {
    const basic = 'html-agent';
    const res = [basic];
    if (isSingleAgent.value) {
        res.push(`${basic}--single`);
    } else {
        res.push(`${basic}--multi`);
    }
    return res.join(' ');
});

const resultFileList = computed(() => {
    const data = resultFileIds.value;

    if (!data || !Array.isArray(data) || data.length === 0) {
        return [];
    }

    const result: AgentFileResultTypes[] = [];

    for (const item of data) {
        if (item?.hit_risk) {
            continue;
        }
        if (item?.meta) {
            if (typeof item?.meta === 'object' && 'cover_url' in item.meta) {
                result.push(item as AgentFileResultTypes);
                continue;
            }

            if (typeof item.meta === 'string') {
                const metaObj = safeJsonParse(item.meta);
                if (typeof metaObj === 'string') {
                    continue;
                }
                result.push({
                    ...item,
                    meta: metaObj,
                } as AgentFileResultTypes);
            }
        }
    }

    return result;
});

const frameArrData = ref<IAgentFrame[]>([]);

const handleFrame = (frame: IAgentFrame[]) => {
    const frameMap = new Map<string, IAgentFrame>();

    frame.forEach((item, index) => {
        if (item.codeContent?.type === 'code_gen') {
            if (!item.runObject) {
                frameMap.set(item.id, item);
                return;
            }

            const runObject = item?.runObject;
            const codeDataList = runObject?.thoughts?.content?.tool_call_response?.data;
            if (!Array.isArray(codeDataList) || codeDataList.length === 0) return;
            const runObjectId = runObject?.id ?? '';

            codeDataList.forEach((codeData, codeIndex) => {
                if (codeData?.agent_sub_type === 'xmind') {
                    return;
                }
                const { code_str = '', code_lang = '', code_end = false, title = '' } = codeData;
                const codeStr = String(code_str);
                const codeLang = String(code_lang);
                const codeTitle = String(title);
                const codeEnd = Boolean(code_end);
                const codeFrameKey = [runObjectId, codeLang || 'code', String(codeIndex)].filter(Boolean).join('_');

                const codeFrameBaseId = `code_gen_${codeFrameKey}`;

                if (frameMap.has(codeFrameBaseId)) {
                    const codeFrame = frameMap.get(codeFrameBaseId);
                    if (codeFrame?.codeContent) {
                        codeFrame.codeContent.codeMarkdown += codeStr;
                        codeFrame.codeContent.codeLang = codeLang;
                        if (codeEnd) {
                            codeFrame.codeContent.codeEnd = true;
                            if (codeData.cover_urls) {
                                codeFrame.codeContent.coverUrls = [...codeData.cover_urls];
                            }
                        }
                        codeFrame.codeContent.title = title;
                    }
                } else {
                    const codeFrame = {
                        id: codeFrameBaseId,
                        thoughts: item.thoughts,
                        raw: item.raw,
                        parsedContent: item.parsedContent,
                        codeContent: {
                            codeMarkdown: codeStr,
                            codeEnd,
                            type: 'code_gen' as const,
                            codeLang,
                            title: codeTitle,
                            coverUrls: undefined,
                            runObjectId: runObjectId,
                        },
                    };
                    frameMap.set(codeFrameBaseId, codeFrame);
                }
            });
        } else {
            frameMap.set(item.id, item);
        }
    });

    frameArrData.value = Array.from(frameMap.values());
};

watch(
    frameListBlockMap,
    frames => {
        if (!frames || !Array.isArray(frames) || frames.length === 0) {
            return;
        }
        handleFrame(frames);
    },
    { deep: true, immediate: true }
);

const showThinking = computed(() => (props.node?.data?.length || 0) > 0);

const agentContainerRef = ref<InstanceType<typeof AgentContainer> | null>(null);

// 内容动态递增时，滚动到最底部
const scrollToBottom = () => {
    if (!agentContainerRef.value) {
        return;
    }
    agentContainerRef.value.scrollToBlock(latestStage.value);
};

// 监听数据增长：标记渲染完成
// immediate: true 保证历史消息挂载时（数据已存在）也能触发 renderEnd，与 FileArrangeAgent 对齐
watch(
    () => [props.node?.data?.length ?? 0, isComplete.value] as const,
    ([dataLength]) => {
        scrollToBottom();
        if (dataLength > 0) {
            onPipelineComplete();
        }
    },
    { flush: 'post', immediate: true }
);

// 当前子步骤名称（从最后一帧获取）
const currentStepName = computed(() => {
    const lastFrame = frameList.value[frameList.value.length - 1];
    if (!lastFrame?.parsedContent) {
        return '';
    }
    return getSummary(lastFrame.parsedContent);
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
.html-agent {
    width: 100%;
    display: flex;
    flex-direction: column;
}

.code-agent-content {
    display: flex;
    flex-direction: column;
}

.agent-loading {
    width: 20px;
    height: 20px;
    margin-top: 10px;
    background-image: url(https://staticsns.cdn.bcebos.com/amis/2026-5/1778489268027/%E8%83%8C%E6%99%AF%20%E8%93%9D%E8%89%B2.png);
    background-size: cover;
}
</style>
