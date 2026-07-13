<template>
    <div
        ref="codeContentWrapperRef"
        class="code-content-wrapper"
        :style="cursorStyle"
        @click.prevent="handleMermaidImageFileOpen"
    >
        <atomic-markdown
            ref="markdownRef"
            :content="contentComputed"
            :is-skip-split="props.frameData?.codeContent?.codeEnd"
            :typer-speed="AtomicMdCommonProps.typerSpeed"
            :is-sse-end="props.frameData?.codeContent?.codeEnd"
            :table-col-min-width="AtomicMdCommonProps.tableColMinWidth"
            :mermaid-container-class="AtomicMdCommonProps.swiperInnerClass"
            :hljs-container-class="AtomicMdCommonProps.swiperInnerClass"
            :table-container-class="`outer-table ${AtomicMdCommonProps.swiperInnerClass}`"
            :mermaidOptions="{
                ratio: 3,
            }"
            :use-typer="!props.isHistory"
            @upload-img="handleUploadImgReq"
            @typer-consume-end="handleTyperConsumeEndDebounce"
        >
            <template #mermaidTr="mermaidTr">
                <div>Mermaid</div>
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

export interface WpUploaderOptions {
    serverPath?: string;
    bdstoken?: string;
    no_report_upload?: number;
}

type PendingExportResolver = (value: string | PromiseLike<string>) => void;

type MarkdownRefInstance = {
    exportMdData?: () => Promise<void> | void;
};

type PendingExportRejecter = (reason?: Error) => void;
</script>

<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, ref, watch, computed } from 'vue';
import type { IAgentFrame } from '@chat/components/Agent/Common';
import { AtomicMdCommonProps } from '@chat/components/Agent/HtmlAgent/constant';
import { handleShowToast, hybridOpenFile } from '@chat/composables/hybridExecute';
import debounce from 'lodash/debounce';
import { base64ToFile } from '@chat/utils/common';
import { userInfoStore } from '@chat/stores/userInfo';
import type { UploadFileInfo } from '@chat/components/Agent/HtmlAgent/types';
import { isIos } from '@chat/utils/envNa';
import WpUploader from '@baidu/wp-upload';

const userStore = userInfoStore();
const userInfo = computed(() => userStore.currentUser as { [key: string]: unknown });

onMounted(async () => {
    if (!userInfo.value?.uk) {
        await userStore._actGetUserInfo();
    }
});

defineOptions({
    name: 'MermaidAtomicMarkdown',
});

const props = defineProps<Props>();

const markdownRef = ref<MarkdownRefInstance | null>(null);

const mermaidImageFileRef = ref<UploadFileInfo | null>(null);

const codeContentWrapperRef = ref<HTMLElement | null>(null);

const cursorStyle = computed(() => {
    if (props.isHistory) {
        return { cursor: 'pointer' };
    }

    return mermaidImageFileRef && mermaidImageFileRef.value?.fs_id ? { cursor: 'pointer' } : { cursor: 'not-allowed' };
});

const contentComputed = computed(() => {
    return props.frameData?.codeContent?.codeMarkdown;
});

// exportMdData 会异步触发 atomic-markdown 内部将 mermaid 转成图片
// 通过 @upload-img 事件回调出 base64，这里用 pending resolver 串联两步
let pendingExportResolver: PendingExportResolver | null = null;
let pendingExportRejecter: PendingExportRejecter | null = null;

const resetPendingExport = () => {
    pendingExportResolver = null;
    pendingExportRejecter = null;
};

// const handleSaveFailed = () => {
//     handleShowToast('Mermaid 图片保存失败');
// };

const handleUploadImgReq = (base64?: string) => {
    if (pendingExportResolver) {
        const resolve = pendingExportResolver;
        resetPendingExport();
        resolve(base64 || '');
    }
};

async function handleTyperConsumeEnd() {
    try {
        // 等待 @upload-img 回调拿到 base64
        const base64Promise = new Promise<string>((resolve, reject) => {
            pendingExportResolver = resolve;
            pendingExportRejecter = reject;
            // 超时保护
            setTimeout(() => {
                if (pendingExportRejecter === reject) {
                    resetPendingExport();
                    reject(new Error('export mermaid image timeout'));
                }
            }, 10000);
        });

        const exportMdData = markdownRef.value?.exportMdData;
        if (!exportMdData) {
            throw new Error('export mermaid image method missing');
        }

        await exportMdData();
        const pngBase64 = await base64Promise;

        console.log(pngBase64, 'pngBase64');

        if (!pngBase64) {
            // handleSaveFailed();
            return;
        }

        const imageFile = base64ToFile(pngBase64, `${props.frameData.codeContent?.title}_${Date.now()}.png`);

        console.log(imageFile, 'imageFile');

        if (!imageFile) {
            return;
        }

        console.log(WpUploader.check(), WpUploader, 'WpUploader WpUploader');

        if (!WpUploader.check() || !imageFile) {
            return;
        }

        if (!userInfo.value?.bdstoken) {
            return;
        }

        const options = {
            isWp: true,
            isDebug: process.env.VITE_APP_PACKAGE_MODE === 'dev',
            domain: window.location.origin,
            accessToken: userInfo.value?.bdstoken,
            uploadPath: '/云一朵/图片',
            no_report_upload: 1,
        };

        console.log(options, 'options');

        const uploader = new WpUploader(options) as {
            upload: (files: File[]) => void;
            on(
                event: string,
                callback:
                    | ((info: unknown, detail: UploadFileInfo) => void)
                    | ((info: unknown, message: unknown) => void)
            ): void;
        };

        uploader.upload([imageFile]);

        // eslint-disable-next-line no-restricted-syntax
        console.log('uploader yunxing');

        uploader.on('success', (info: unknown, detail: UploadFileInfo) => {
            // eslint-disable-next-line no-restricted-syntax
            console.log(info, detail, 'upload success');
            if (props.isHistory) {
                hybridOpenFile({ ...detail }).catch(() => {
                    handleShowToast('Mermaid 图片预览失败');
                });

                return;
            }
            mermaidImageFileRef.value = detail;
        });
        uploader.on('error', (info: unknown, message: unknown) => {
            // eslint-disable-next-line no-restricted-syntax
            console.log(info, message, 'upload error');
            handleShowToast('Mermaid 图片预览失败');
            // handleSaveFailed();
        });
    } catch {
        resetPendingExport();
        // handleSaveFailed();
    }
}

const handleTyperConsumeEndDebounce = debounce(async function () {
    if (isIos) {
        return;
    }

    await handleTyperConsumeEnd();
 }
, 300, { leading: true, trailing: false });

const handleMermaidImageFileOpen = debounce(
    async function () {
        if (isIos) {
            return;
        }

        handleShowToast('加载中，请稍后');
        if (props.isHistory) {
            console.log('history');
            await handleTyperConsumeEnd();
        } else {
            console.log('not history');
            if (mermaidImageFileRef.value && mermaidImageFileRef.value.fs_id) {
                console.log('mermaidImageFileRef');
                hybridOpenFile({ ...mermaidImageFileRef.value }).catch(() => {
                    handleShowToast('Mermaid 图片预览失败');
                });
            } else {
                // 如果当前还没有上传成功，重新触发一次上传流程，保证用户最大程度的可以打开图片
                console.log('mermaidImageFileRef handleTyperConsumeEnd upload');
                await handleTyperConsumeEnd();
            }
        }
    },
    1000,
    { leading: true, trailing: false }
);

const getCodeScrollEl = () => {
    // mermaid 有两种形态：流式代码块用 .atomic-hljs-code-wrap，渲染完成的图表容器用 .content-wrap
    return codeContentWrapperRef.value?.querySelector('.atomic-hljs-code-wrap, .content-wrap') as HTMLElement | null;
};

// 贴底判定阈值（px）
const NEAR_BOTTOM_THRESHOLD = 20;

// 是否处于"自动跟随底部"状态
// 核心判定规则：
// - wheel / touchmove 事件（真·用户操作）→ 下一帧读 scrollTop，双向翻转 autoFollow
// - scroll 事件（含程序回响、布局重排、惯性滚动尾声）→ 只允许"贴底时单向翻 true"，
//   不能反向翻 false，从而规避"我们自己写入 scrollTop 的 scroll 回响在 DOM 已长大后抵达"
//   被误判为用户上滑的竞态。
let autoFollow = true;

let scrollEl: HTMLElement | null = null;
let wrapperObserver: MutationObserver | null = null;
let contentObserver: MutationObserver | null = null;
let userIntentRafId: number | null = null;

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
    const el = getCodeScrollEl();
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
    :deep(.atomic-markdown) {
        margin-top: 8px;
        margin-bottom: 8px;

        .markdown-render-container {
            .wp-swiper-inner-container {
                border-radius: 16px;
                box-sizing: border-box;
                max-height: 390px;
                border: 0px;

                .menu-wrap {
                    border-top: 1px solid #e8ebf2;
                    border-left: 1px solid #e8ebf2;
                    border-right: 1px solid #e8ebf2;
                    box-sizing: border-box;
                    border-top-left-radius: 16px;
                    border-top-right-radius: 16px;
                    background: rgba(245, 247, 250, 1);
                    width: 100%;
                    min-height: 40px !important;
                    height: 40px !important;
                    max-height: 40px !important;
                    padding: 0 16px !important;
                    box-sizing: border-box;

                    .toggle-mode {
                        display: flex;
                        padding: 0px;
                        height: 40px;
                        align-items: center;

                        .toggle-mode-container {
                            display: none;
                        }
                        .menu-right-container {
                            width: 100%;
                            height: 100%;
                            display: flex;
                            align-items: center;
                            justify-content: flex-start;

                            div {
                                font-family: PingFang SC;
                                font-weight: 500;
                                font-style: Medium;
                                font-size: 14px;
                                letter-spacing: 0px;
                                color: rgba(31, 31, 31, 1);
                            }

                            img {
                                width: 18px;
                                height: 18px;
                                display: inline-block;
                                cursor: pointer;
                            }
                        }
                    }
                }

                .content-wrap {
                    width: 100%;
                    padding: 12px;
                    max-height: 350px;
                    box-sizing: border-box;
                    overflow-y: auto;
                    background: rgba(255, 255, 255, 1);
                    border-left: 1px solid #e8ebf2;
                    border-right: 1px solid #e8ebf2;
                    border-bottom: 1px solid #e8ebf2;
                    box-sizing: border-box;
                    border-bottom-left-radius: 16px;
                    border-bottom-right-radius: 16px;

                    &::-webkit-scrollbar {
                        display: none;
                    }
                }

                .bottom-slot-container {
                    display: none;
                }
            }
        }
    }
}
</style>
