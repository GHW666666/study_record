<template>
    <div class="html-agent-block">
        <div :class="isSingleAgent ? 'agent-thought-single' : 'agent-thought-multi'">
            <widget-config-provider :config="widgetConfig">
                <atomic-agentic-thought
                    :block-map="props.content"
                    :use-typer="!isHistory"
                    @widget-event="handleWidgetEvent"
                    @pipeline-complete="handlePipelineComplete"
                />
            </widget-config-provider>
        </div>
    </div>
</template>

<script lang="ts">
import type { HtmlAgentThoughtProps, WidgetEvent } from '@chat/components/Agent/HtmlAgent/types';
</script>

<script lang="ts" setup>
import { onMounted } from 'vue';
import { WidgetConfigProvider } from '@baidu/atomic-components';
import { openWebview, openImgList, openImg } from '@chat/composables/hybridExecute';

const props = defineProps<HtmlAgentThoughtProps>();

const widgetConfig = {
    taskList: {
        block: 'full',
    },
    sourceLinkList: {
        collapsedCount: 3,
    },
    imageList: {
        expandMore: false,
        foldRows: 2,
        itemColumn: 3,
        itemEqualMode: true,
        itemOptions: {
            itemSpace: '2px',
        },
    },
};

/** 打开图片 */
const clickImageList = (event: WidgetEvent) => {
    if (!event.action) {
        return;
    }
    if (event.action === 'img' && event?.payload) {
        const { list: imageList = [], index: curIndex } = event.payload;
        const url_list = imageList.map(item => item.url || '').filter(Boolean) as string[];
        const index = Number(curIndex) || 0;

        if (url_list.length === 0) {
            return;
        }

        openImg({ index, url_list });
        return;
    }

    if (event.action === 'view-all' && event?.payload) {
        const { list: imageList = [] } = event.payload;
        const url_list = imageList.map(item => item.url || '').filter(Boolean) as string[];

        if (url_list.length === 0) {
            return;
        }

        openImgList({ url_list });
    }
};

// widget 事件处理
function handleWidgetEvent(event: WidgetEvent) {
    if (!event || !event?.source) {
        return;
    }

    const { action } = event;

    if (action === 'view-all') {
        event?.payload?.expand?.();
    }

    if (action === 'collapse') {
        event?.payload?.collapse?.();
    }

    if (event.source === 'imageList') {
        clickImageList(event);
    }

    if (event.source === 'sourceLinkList') {
        const url = event?.payload?.item?.url || '';
        if (url) {
            openWebview(url as string);
        }
    }
}

const handlePipelineComplete = () => {
    if (props.onPipelineComplete) {
        props.onPipelineComplete();
    }
};

onMounted(() => {
    // 如果没有内容，直接触发渲染完成
    if (!props.content?.orderedKeys || props.content?.orderedKeys?.length === 0) {
        if (props.onPipelineComplete) {
            props.onPipelineComplete();
        }
    }
});
</script>

<style lang="scss" scoped>
.html-agent-block {
    width: 100%;
}
.agent-thought-single {
    @import '@chat/components/Agent/Common/agentThought_single.scss';
}
.agent-thought-multi {
    @import '@chat/components/Agent/Common/agentThought_multi.scss';
}
</style>
