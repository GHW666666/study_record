import { shallowReactive } from 'vue';
import type { AgentFileResultTypes } from '@chat/components/Agent/HtmlAgent/types';

const fileMap = shallowReactive(new Map<string, AgentFileResultTypes>());

export function useHtmlAgentFileRegistry() {
    const registerFiles = (files: AgentFileResultTypes[] = []) => {
        const toolCallIds: string[] = [];

        files.forEach(file => {
            const toolCallId = file.meta?.tool_call_id;
            if (!toolCallId) {
                return;
            }

            fileMap.set(toolCallId, file);
            toolCallIds.push(toolCallId);
        });

        return toolCallIds;
    };

    const unregisterFiles = (toolCallIds: string[] = []) => {
        toolCallIds.forEach(toolCallId => {
            fileMap.delete(toolCallId);
        });
    };

    const getFileByToolCallId = (toolCallId?: string) => {
        return toolCallId ? fileMap.get(toolCallId) : undefined;
    };

    return {
        registerFiles,
        unregisterFiles,
        getFileByToolCallId,
    };
}
