<template>
    <div
        class="html-multi-result-card"
        :class="{ 'html-multi-result-card--mini': currentCardType === 'small', 'html-multi-result-card--harmony': isHarmony }"
        v-for="(file, index) in resultContent"
        :key="`${file.file_id}-${index}`"
    >
        <div
            v-if="currentCardType === 'small'"
            class="mini-card"
        >
            <atomic-mini-result-card
                :key="`${file?.file_id}-${index}`"
                layout="compact"
                :file-type="getFileTypeBtnList(file, 'type')"
                theme="netdisk"
                :bg-mode="props.node || isSingleAgent ? 'gray' : 'white'"
                :title="file?.title || file?.name || file?.meta?.['netdisk.filename']"
                :subtitle="formatSize(file?.size)"
                :cover-urls="[imageCoverUrl(file)]"
                @click="({ payload }: { payload: GeneralMiniResultCardItemType }) => handleCardClick({ file, payload })"
            ></atomic-mini-result-card>
        </div>
        <atomic-general-result-card
            v-else
            layout="compact"
            class="large-card"
            theme="netdisk"
            :file-type="getFileTypeBtnList(file, 'type')"
            :title="file?.title || file?.name || file?.meta?.['netdisk.filename']"
            :cover-urls="[imageCoverUrl(file)]"
            :list="squareList"
            :btn-list="getFileTypeBtnList(file, 'btnList')"
            @click="({ payload }: { payload: GeneralResultCardBtnItemType }) => handleClickDownload({ payload, file })"
            fallback="https://staticsns.cdn.bcebos.com/amis/2026-5/1778135108121/wp-backup.png"
        />
    </div>
</template>

<script lang="ts">
type GeneralResultCardBtnItemType = {
    text?: string;
    action?: string;
    fileType?: string;
    icon?: string;
};

type GeneralMiniResultCardItemType = {
    title?: string;
    coverUrls?: string[];
    fileType?: string;
    layout?: string;
};
</script>

<script lang="ts" setup>
import type {
    HtmlAgentMultiResultCardProps,
    AgentFileMetaTypes,
    AgentFileResultTypes,
} from '@chat/components/Agent/HtmlAgent/types';
import { computed, onUnmounted, watch } from 'vue';
import { fileTypeMap } from '@chat/utils/fileTypeMap';
import { getType } from '@chat/utils/fileIcon';
import { hybridOpenFile, hybridDownloadFile, openCustomTitleWebview, handleShowToast } from '@chat/composables/hybridExecute';
import { formatSize } from '@chat/utils/common';
import getImageForPath from '@chat/utils/getImageForPath';
import { handleFileInfo, safeDecode } from '@chat/components/Agent/HtmlAgent/utils';
import { useHtmlAgentFileRegistry } from '@chat/components/Agent/HtmlAgent/composables/useHtmlAgentFileRegistry';
import { ModelType } from '@monorepo/nd-plugin-core/src/types';
import { isAndroid, isHarmony } from '@chat/utils/envNa';

const props = defineProps<HtmlAgentMultiResultCardProps>();
const { registerFiles, unregisterFiles } = useHtmlAgentFileRegistry();
let registeredToolCallIds: string[] = [];

defineOptions({
    name: 'HtmlMultiTypeResultCard',
});

const parseJsonValue = (value: unknown): unknown => {
    if (typeof value !== 'string') {
        return value;
    }

    try {
        return JSON.parse(value) as unknown;
    } catch {
        return null;
    }
};

const normalizeMeta = (meta: unknown): AgentFileMetaTypes => {
    if (!meta) {
        return {};
    }

    if (typeof meta === 'string') {
        const parsedMeta = parseJsonValue(meta);
        return parsedMeta && typeof parsedMeta === 'object' && !Array.isArray(parsedMeta)
            ? (parsedMeta as AgentFileMetaTypes)
            : {};
    }

    return typeof meta === 'object' && !Array.isArray(meta) ? (meta as AgentFileMetaTypes) : {};
};

const normalizeFile = (file: unknown): AgentFileResultTypes | null => {
    if (!file || typeof file !== 'object' || Array.isArray(file)) {
        return null;
    }

    const fileInfo = file as AgentFileResultTypes & { meta?: unknown };
    return {
        ...fileInfo,
        meta: normalizeMeta(fileInfo.meta),
    } as AgentFileResultTypes;
};

const getFilesFromNode = () => {
    const node = props.node as Record<string, unknown> | undefined;
    if (!node) {
        return [];
    }

    const result: AgentFileResultTypes[] = [];
    const pushFile = (file: unknown) => {
        const normalizedFile = normalizeFile(file);
        if (normalizedFile) {
            result.push(normalizedFile);
        }
    };
    const pushFileList = (files: unknown) => {
        if (Array.isArray(files)) {
            files.forEach(pushFile);
        }
    };
    const pushFileContent = (contentItem: unknown) => {
        if (!contentItem || typeof contentItem !== 'object' || Array.isArray(contentItem)) {
            return;
        }

        const contentRecord = contentItem as Record<string, unknown>;
        if (contentRecord.type && contentRecord.type !== 'file') {
            return;
        }

        const text = contentRecord.text as Record<string, unknown> | undefined;
        pushFile(parseJsonValue(text?.value));
    };

    const thoughts = node.thoughts as { content?: unknown } | undefined;
    pushFileList(parseJsonValue(thoughts?.content));

    const nodeData = node.data;

    if (Array.isArray(nodeData)) {
        nodeData.forEach(dataItem => {
            const dataRecord = parseJsonValue(dataItem) as Record<string, unknown> | null;

            if (!dataRecord || typeof dataRecord !== 'object') {
                return;
            }

            const content = dataRecord.content;
            if (Array.isArray(content)) {
                content.forEach(pushFileContent);
            }

            const details = dataRecord?.details as Record<string, unknown> | undefined;
            const runObject = details?.run_object as Record<string, unknown> | undefined;
            const dataThoughts =
                (dataRecord?.thoughts as { content?: unknown } | undefined) ||
                (runObject?.thoughts as { content?: unknown } | undefined);
            if (dataThoughts?.content) {
                pushFileList(parseJsonValue(dataThoughts.content));
            }
        });
    }

    return result;
};

const resultContent = computed(() => {
    const content = props.content || [];
    const files = content.length > 0 ? content : getFilesFromNode();
    return files.map(normalizeFile).filter(Boolean) as AgentFileResultTypes[];
});

watch(
    resultContent,
    files => {
        unregisterFiles(registeredToolCallIds);
        registeredToolCallIds = registerFiles(files);
    },
    { immediate: true, deep: true }
);

onUnmounted(() => {
    unregisterFiles(registeredToolCallIds);
});

const isSingleAgent = computed(() => {
    return props.node?.chatData?.modelType === ModelType.SINGLE_AGENT;
});

const currentCardType = computed(() => {
    if (props?.size === 'large') {
        return props.size;
    }
    if (props.cardType && props.content && props.content?.length > 0) {
        return props.cardType;
    }
    if (props.node) {
        if (isSingleAgent.value) {
            return 'large';
        } else {
            return 'small';
        }
    }
    return 'small';
});

const squareList = (file: AgentFileResultTypes) => {
    return [{ src: file?.meta?.cover_url }];
};

const imageCoverUrl = (file: AgentFileResultTypes) => {
    let res = file?.meta?.cover_url;

    if (res) {
        return res;
    }

    let path = '';
    if (file?.meta?.['netdisk.path']) {
        path = file?.meta?.['netdisk.path'];
    } else if ('path' in file) {
        path = file.path as string;
    }

    res = getImageForPath(path);

    return res;
};

function handleClickDownload({ payload, file }: { payload: GeneralResultCardBtnItemType; file: AgentFileResultTypes }) {
    if (payload?.fileType === 'svg' && !payload?.action) {
        const data = handleFileInfo(file);
        hybridOpenFile({ ...data });
        return;
    }

    if (payload?.action === 'download') {
        const data = handleFileInfo(file);
        hybridDownloadFile({ ...data });
        return;
    }

    if (payload?.action === 'html_preview') {
        const data = handleFileInfo(file);
        openCustomTitleWebview({
            url: data?.share_url || data?.meta?.share_url || '',
            title: data?.name || data?.filename || data?.meta?.['netdisk.filename'] || '文件预览.html',
        });
        return;
    }

    if (payload?.action === 'xmind_mindmap_preview') {
        const data = handleFileInfo(file);
        const path = data?.parent_path || data?.meta?.['netdisk.parent_path'] || '';
        hybridOpenFile(
            {
                ...data,
                fs_id: undefined,
                fsid: undefined,
                path: isAndroid ? safeDecode(path) : path,
                isdir: 1,
            },
            true
        );
        return;
    }

    if (payload?.action === 'code_preview') {
        const data = handleFileInfo(file);
        hybridOpenFile({ ...data });
        return;
    }
}

const getFileTypeBtnList = (value: AgentFileResultTypes, handle?: 'type' | 'btnList') => {
    const fileType = fileTypeMap.get(value.file_type ? Number(value.file_type) : -1);

    if (fileType && handle === 'type') {
        if (fileType === 'xmind') {
            return 'mindmap';
        }
        return fileType;
    }

    if (value?.meta?.agent_sub_type && handle === 'type') {
        return value?.meta?.agent_sub_type === 'xmind' ? 'mindmap' : value?.meta?.agent_sub_type;
    }

    let fileNameType = fileType || getType('', value?.meta?.['netdisk.filename'] || '', false);

    if (fileNameType === 'other') {
        if (handle === 'type') {
            return 'unknown';
        }
        if (handle === 'btnList') {
            return [];
        }
    }

    if (handle === 'type') {
        return fileNameType === 'xmind' ? 'mindmap' : fileNameType;
    }

    if (handle === 'btnList') {
        if (fileNameType === 'svg' || fileNameType === 'image') {
            return [
                {
                    icon: '',
                    action: '',
                    text: '',
                },
                {
                    icon: 'https://staticsns.cdn.bcebos.com/amis/2026-4/1777530654198/download.png',
                    action: 'download',
                },
            ];
        }
        if (fileNameType === 'code') {
            return [
                {
                    text: '立即查看',
                    action: 'html_preview',
                },
            ];
        }

        if (fileNameType == 'xmind' || fileNameType === 'mindmap') {
            return [
                {
                    text: '立即查看',
                    action: 'xmind_mindmap_preview',
                },
            ];
        }

        return [
            {
                text: '立即查看',
                action: 'code_preview',
            },
        ];
    }
};

function handleCardClick({ file, payload }: { file: AgentFileResultTypes; payload: GeneralMiniResultCardItemType }) {
    const data = handleFileInfo(file);

    const name = data?.name || data?.filename || data?.meta?.['netdisk.filename'];

    if (name && typeof name === 'string' && name.split('.').pop() === 'html') {
        openCustomTitleWebview({
            url: data?.share_url || data?.meta?.share_url || '',
            title: data?.name || data?.filename || data?.meta?.['netdisk.filename'] || '文件预览.html',
        });
        return;
    }

    if (payload?.fileType === 'mindmap' || payload?.title?.split('.').pop() === 'xmind') {
        const path = data?.parent_path || data?.meta?.['netdisk.parent_path'] || '';
        if (!path) {
            handleShowToast('当前暂不支持查看该文件～');
            return;
        }
        hybridOpenFile(
            {
                ...data,
                fs_id: undefined,
                fsid: undefined,
                path: isAndroid ? safeDecode(path) : path,
                isdir: 1,
            },
            true
        );
    } else {
        hybridOpenFile({ ...data });
    }
}
</script>

<style lang="scss" scoped>
.html-multi-result-card {
    width: 100%;

    .mini-card {
        width: 100%;
    }
    :deep(.atomic-general-result-card-code-compact-svg) {
        box-sizing: border-box;

        .atomic-image {
            border: 1px solid #e8ebf2;
            border-radius: 12px;
            box-sizing: border-box;
        }
    }

    :deep(.atomic-general-result-card-file-compact .large-card) {
        width: 100% !important;
    }

    .large-card {
        width: 100%;
        // max-height: 390px !important;
        box-sizing: border-box;
        margin-top: 8px;

        :deep(.architecture-btn-left) {
            display: none;
        }

        :deep(.atomic-general-result-card-file-compact) {
            width: 100% !important;
        }

        :deep(.code-compact-mindmap) {
            width: 100% !important;
            .atomic-image-background {
                background-position: center;
            }
        }

        :deep(.atomic-image-background) {
            background-position: center;
        }

        :deep(.atomic-image-fallback) {
            background-size: cover;
            background-position: center;
        }
    }
}

/* Harmony 端窄屏修复：原子组件 .atomic-general-result-card-file-compact 内置 width:380px/height:420px，
   窄屏下需自适应宽度并保持原 380:420 比例。 */
.html-multi-result-card--harmony :deep(.atomic-general-result-card-file-compact) {
    width: 100% !important;
    height: auto !important;
    aspect-ratio: 380 / 420;
}
</style>
