<template>
    <div
        ref="codeContentWrapperRef"
        class="code-content-wrapper"
    >
        <atomic-markdown
            class="markdown"
            :content="contentComputed"
            :is-skip-split="props.frameData?.codeContent?.codeEnd"
            :typer-speed="AtomicMdCommonProps.typerSpeed"
            :is-sse-end="props.frameData?.codeContent?.codeEnd"
            :table-col-min-width="AtomicMdCommonProps.tableColMinWidth"
            :table-container-class="`outer-table ${AtomicMdCommonProps.swiperInnerClass}`"
            :use-typer="props.isHistory"
        >
            <template #codeTr="slotsProps">
                <!-- 下载功能暂不需要 -->
                <!-- <img
                    src="https://staticsns.cdn.bcebos.com/amis/2026-5/1777692435042/download.png"
                    alt="下载"
                    @click.prevent="handleDownloadClick"
                    :aria-disabled="!currentFileDataInfo"
                    :class="currentFileDataInfo ? 'download-btn' : 'download-btn-disabled'"
                /> -->
                <img
                    src="https://staticsns.cdn.bcebos.com/amis/2026-5/1778055433223/copy-btn.png"
                    alt="复制"
                    class="copy-img-btn"
                    @click.prevent="handleCopyClick"
                />
            </template>
        </atomic-markdown>
    </div>
</template>

<script lang="ts">
interface Props {
    frameData: IAgentFrame;
    fileData: AgentFileResultTypes[];
    onPipelineComplete: () => void;
    isComplete?: boolean;
    latestStage: string;
    isHistory: boolean;
}
</script>

<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, ref, watch, computed } from 'vue';
import type { IAgentFrame } from '@chat/components/Agent/Common';
import { AtomicMdCommonProps } from '@chat/components/Agent/HtmlAgent/constant';
import { copyToclipboard, handleShowToast } from '@chat/composables/hybridExecute';
import { AgentFileResultTypes } from '@chat/components/Agent/HtmlAgent/types';
// import { handleFileInfo } from '@chat/components/Agent/HtmlAgent/utils';
// import { useHtmlAgentFileRegistry } from '@chat/components/Agent/HtmlAgent/composables/useHtmlAgentFileRegistry';

defineOptions({
    name: 'CodeAtomicMarkdown',
});

const props = defineProps<Props>();
// const { getFileByToolCallId } = useHtmlAgentFileRegistry();

const contentComputed = computed(() => {
    return props.frameData?.codeContent?.codeMarkdown;
});

const codeContentWrapperRef = ref<HTMLElement | null>(null);

// 贴底判定阈值（px）
const NEAR_BOTTOM_THRESHOLD = 20;

// 是否处于"自动跟随底部"状态
// 核心判定规则：
// - wheel / touchmove 事件（真·用户操作）→ 下一帧读 scrollTop，双向翻转 autoFollow
// - scroll 事件（含程序回响、hljs 布局重排、惯性滚动尾声）→ 只允许"贴底时单向翻 true"，
//   不能反向翻 false，从而规避"我们自己写入 scrollTop 的 scroll 回响在 DOM 已长大后抵达"
//   被误判为用户上滑的竞态。
let autoFollow = true;

// 滚动元素（由 atomic-markdown 内部渲染）
let scrollEl: HTMLElement | null = null;
// 监听 wrapper 子树，用于发现/重新发现 scrollEl
let wrapperObserver: MutationObserver | null = null;
// 监听 scrollEl 内容变化（新代码写入 / typer 逐字更新）
let contentObserver: MutationObserver | null = null;
// wheel/touchmove 后延后一帧读 scrollTop 用的 rAF id
let userIntentRafId: number | null = null;

const handleCopyClick = async () => {
    const result = await copyToclipboard({
        text: contentComputed.value || '',
    });
    const hasErrno = typeof result === 'object' && result !== null && 'errno' in result;
    const isCopySuccess = !(result instanceof Error) && (!hasErrno || result.errno === 0);
    handleShowToast(isCopySuccess ? '已复制' : '复制失败');
};

const isNearBottom = (el: HTMLElement) => {
    return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_THRESHOLD;
};

// scroll 事件：单向兜底
// - 贴底 → 允许把 autoFollow 由 false 翻成 true（惯性滚动尾声、键盘滚动、滚动条拖拽等
//   wheel/touchmove 覆盖不到的路径，通过这里补全"回到底部即恢复跟随"）
// - 不贴底 → 不做任何事，避免把程序回响误判成用户上滑
const handleScroll = () => {
    if (!scrollEl) {
        return;
    }
    if (isNearBottom(scrollEl)) {
        autoFollow = true;
    }
};

// 用户真·滚动意图：wheel / touchmove 只在物理操作时触发
// 延后一帧再读 scrollTop —— wheel 在滚动发生前派发，当帧读到的是旧值
const scheduleUserIntentCheck = () => {
    if (userIntentRafId !== null) {
        return;
    }
    userIntentRafId = window.requestAnimationFrame(() => {
        userIntentRafId = null;
        if (!scrollEl) {
            return;
        }
        autoFollow = isNearBottom(scrollEl);
    });
};

const scrollToBottom = () => {
    if (!scrollEl || !autoFollow) {
        return;
    }
    scrollEl.scrollTop = scrollEl.scrollHeight;
};

// 绑定到 scrollEl：监听用户输入事件 + scroll 兜底 + 内容变化
const bindScrollEl = (el: HTMLElement) => {
    scrollEl = el;
    el.addEventListener('scroll', handleScroll, { passive: true });
    el.addEventListener('wheel', scheduleUserIntentCheck, { passive: true });
    el.addEventListener('touchmove', scheduleUserIntentCheck, { passive: true });

    // 监听内容变化：childList（新增节点）+ characterData（typer 改 Text 节点）+ subtree
    contentObserver = new MutationObserver(() => {
        scrollToBottom();
    });
    contentObserver.observe(el, { childList: true, subtree: true, characterData: true });

    // 初次绑定即尝试贴底
    scrollToBottom();
};

const unbindScrollEl = () => {
    if (scrollEl) {
        scrollEl.removeEventListener('scroll', handleScroll);
        scrollEl.removeEventListener('wheel', scheduleUserIntentCheck);
        scrollEl.removeEventListener('touchmove', scheduleUserIntentCheck);
    }
    contentObserver?.disconnect();
    contentObserver = null;
    scrollEl = null;
    if (userIntentRafId !== null) {
        window.cancelAnimationFrame(userIntentRafId);
        userIntentRafId = null;
    }
};

// 尝试定位并绑定 scrollEl；若已绑定且仍在 DOM 中则复用
const attachScrollEl = () => {
    if (scrollEl && codeContentWrapperRef.value?.contains(scrollEl)) {
        return;
    }
    // 旧元素被卸载（atomic-markdown 内部重建）→ 清理并重新查找
    if (scrollEl) {
        unbindScrollEl();
    }
    const el = codeContentWrapperRef.value?.querySelector('.atomic-hljs-code-wrap') as HTMLElement | null;
    if (el) {
        bindScrollEl(el);
    }
};

onMounted(() => {
    // 历史态进入时让用户从头阅读，不自动跟随
    if (props.isHistory) {
        autoFollow = false;
    }

    if (codeContentWrapperRef.value) {
        wrapperObserver = new MutationObserver(() => {
            attachScrollEl();
        });
        wrapperObserver.observe(codeContentWrapperRef.value, {
            childList: true,
            subtree: true,
        });
    }
    attachScrollEl();
});

onUnmounted(() => {
    wrapperObserver?.disconnect();
    wrapperObserver = null;
    unbindScrollEl();
});

// 流式结束时做一次兜底贴底（若仍在自动跟随状态）
watch(
    () => props.frameData?.codeContent?.codeEnd,
    async codeEnd => {
        if (!codeEnd) {
            return;
        }
        await nextTick();
        scrollToBottom();
    },
    { flush: 'post' }
);

watch(
    () => props?.isComplete,
    val => {
        if (val) {
            props?.onPipelineComplete();
        }
    },
    { flush: 'post', immediate: true }
);
</script>

<style lang="scss" scoped>
.code-content-wrapper {
    :deep(.atomic-markdown) {
        margin-top: 8px;
        margin-bottom: 8px;
        border: 1px solid #e8ebf2;
        border-radius: 16px;
        box-sizing: border-box;

        .markdown-render-container {
            .atomic-hljs {
                border-radius: 16px;
                box-sizing: border-box;
                height: 390px;
                margin: 0px;
                border: 0px;
            }

            .atomic-hljs-lang-title {
                background: rgba(245, 247, 250, 1);
                width: 100%;
                height: 40px;
                padding: 0 16px;
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: space-between;

                .hljs-lang-title-lang {
                    // 单词首字母大写
                    text-transform: capitalize;
                    color: rgba(31, 31, 31, 1);
                    font-size: 14px;
                    font-family: PingFang SC;
                    font-weight: 500;
                    font-style: Medium;
                    letter-spacing: 0px;
                }
                .hljs-lang-title-slots {
                    display: flex;
                    align-items: center;
                    gap: 16px;

                    img {
                        width: 18px;
                        height: 18px;
                        display: inline-block;
                    }

                    .copy-img-btn {
                        cursor: pointer;
                    }

                    // .download-btn {
                    //     cursor: pointer;
                    // }

                    // .download-btn-disabled {
                    //     cursor: not-allowed;
                    //     opacity: 0.4;
                    // }
                }
            }
            .atomic-hljs-code-wrap {
                width: 100%;
                padding: 12px;
                height: 350px;
                overflow-y: auto;
                box-sizing: border-box;
                &::-webkit-scrollbar {
                    display: none;
                }
            }
        }
    }
}
</style>
