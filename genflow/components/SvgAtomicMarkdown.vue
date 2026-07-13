<template>
    <div
        ref="codeContentWrapperRef"
        class="code-content-wrapper"
    >
        <!-- <img
            class="product-img"
            v-if="
                props.frameData?.codeContent?.codeLang === 'svg' &&
                props.frameData?.codeContent?.codeEnd === true &&
                props.frameData?.codeContent?.coverUrls &&
                props.frameData?.codeContent?.coverUrls?.length > 0
            "
            :src="props.frameData?.codeContent?.coverUrls?.[0]"
            referrerpolicy="no-referrer"
        /> -->
        <atomic-markdown
            :content="contentComputed"
            :is-skip-split="props.frameData?.codeContent?.codeEnd"
            :typer-speed="AtomicMdCommonProps.typerSpeed"
            :is-sse-end="props.frameData?.codeContent?.codeEnd"
            :table-col-min-width="AtomicMdCommonProps.tableColMinWidth"
            :mermaid-container-class="AtomicMdCommonProps.swiperInnerClass"
            :hljs-container-class="AtomicMdCommonProps.swiperInnerClass"
            :table-container-class="`outer-table ${AtomicMdCommonProps.swiperInnerClass}`"
            :use-typer="!props.isHistory"
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

defineOptions({
    name: 'SvgAtomicMarkdown',
});

const props = defineProps<Props>();

const codeContentWrapperRef = ref<HTMLElement | null>(null);

const contentComputed = computed(() => {
    return props.frameData?.codeContent?.codeMarkdown;
});

// 贴底判定阈值（px）
const NEAR_BOTTOM_THRESHOLD = 20;

// 是否处于"自动跟随底部"状态
// 核心判定规则：
// - wheel / touchmove 事件（真·用户操作）→ 下一帧读 scrollTop，双向翻转 autoFollow
// - scroll 事件（含程序回响、hljs 布局重排、惯性滚动尾声）→ 只允许"贴底时单向翻 true"，
//   不能反向翻 false，从而规避"我们自己写入 scrollTop 的 scroll 回响在 DOM 已长大后抵达"
//   被误判为用户上滑的竞态。
let autoFollow = true;

let scrollEl: HTMLElement | null = null;
let wrapperObserver: MutationObserver | null = null;
let contentObserver: MutationObserver | null = null;
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

// scroll 事件：单向兜底（贴底 → true）
const handleScroll = () => {
    if (!scrollEl) {
        return;
    }
    if (isNearBottom(scrollEl)) {
        autoFollow = true;
    }
};

// wheel / touchmove：真·用户操作，延后一帧读 scrollTop 双向翻转
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

const bindScrollEl = (el: HTMLElement) => {
    scrollEl = el;
    el.addEventListener('scroll', handleScroll, { passive: true });
    el.addEventListener('wheel', scheduleUserIntentCheck, { passive: true });
    el.addEventListener('touchmove', scheduleUserIntentCheck, { passive: true });

    contentObserver = new MutationObserver(() => {
        scrollToBottom();
    });
    contentObserver.observe(el, { childList: true, subtree: true, characterData: true });

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

const attachScrollEl = () => {
    if (scrollEl && codeContentWrapperRef.value?.contains(scrollEl)) {
        return;
    }
    if (scrollEl) {
        unbindScrollEl();
    }
    const el = codeContentWrapperRef.value?.querySelector('.atomic-hljs-code-wrap') as HTMLElement | null;
    if (el) {
        bindScrollEl(el);
    }
};

onMounted(() => {
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
    .product-img {
        width: 100%;
        border-radius: 16px;
        margin: 12px 0px;
    }
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
