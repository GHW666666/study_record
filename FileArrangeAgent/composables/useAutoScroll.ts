import { onMounted, onUnmounted, watch, nextTick, type Ref } from 'vue';
import { useTouch } from '@chat/hooks/useTouch';
import { scrollElementIntoView } from '@chat/utils/toolScroll';

export interface UseAutoScrollOptions {
    thoughtRef: Ref<HTMLElement | null>;
    agentContainerRef: Ref<{ containerRef?: HTMLElement | null; contentRef?: HTMLElement | null } | null>;
    isSingleAgent: Ref<boolean>;
    // 任务是否已完成（出结束语）。执行过程中不吸底，仅完成后吸底，避免用户上滑浏览整理方案时被拽回底部。
    isComplete: Ref<boolean>;
}

/**
 * 监听思考链区域 DOM 变化（如整理总结文字流式输出），自动将底部新内容滚入可视区。
 * stage 切换滚动由外部 scrollToBlock watch 处理，本 composable 仅负责 block 内容增长时的贴底。
 * 注意：任务执行过程中不自动吸底，只有任务完成（isComplete）后才跟随，
 * 以便用户在执行中自由上滑查看整理方案 / 总结。
 */
export function useAutoScroll(options: UseAutoScrollOptions) {
    const { thoughtRef, agentContainerRef, isSingleAgent, isComplete } = options;
    const { inTouch } = useTouch();

    let mutationObserver: MutationObserver | null = null;

    const scrollToBottom = () => {
        if (inTouch.value) return;
        // 任务执行过程中不吸底，仅在任务完成（出结束语）后才跟随
        if (!isComplete.value) return;

        const el = thoughtRef.value;
        if (!el) return;

        if (isSingleAgent.value) {
            scrollElementIntoView(
                el,
                document.getElementById('chatsWrapRoot'),
                { behavior: 'instant' }
            );
        } else {
            const content = agentContainerRef.value?.contentRef;
            if (content) {
                content.scrollTop = content.scrollHeight;
            }
        }
    };

    const startObserving = () => {
        const el = thoughtRef.value;
        if (!el) return;

        mutationObserver?.disconnect();
        mutationObserver = new MutationObserver(() => {
            scrollToBottom();
        });
        mutationObserver.observe(el, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    };

    onMounted(() => {
        startObserving();
    });

    watch(thoughtRef, () => {
        startObserving();
    }, { flush: 'post' });

    // 任务完成瞬间主动吸底一次，确保结束语可见（此后内容不再增长，MutationObserver 可能不再触发）
    watch(isComplete, done => {
        if (done) {
            nextTick(() => scrollToBottom());
        }
    });

    onUnmounted(() => {
        mutationObserver?.disconnect();
        mutationObserver = null;
    });

    return { scrollToBottom };
}
