import type { BlockMap } from '@baidu/atomic-components';
import type { INode } from '@monorepo/nd-plugin-core/src';

export type HtmlAgentMultiResultCardProps = {
    content?: AgentFileResultTypes[];
    node?: INode
    stage?: string;
    onRenderEnd?: () => void;
    onClick?: (event: Event) => void;
    onPipelineComplete?: (event?: Event) => void;
    cardType?: 'large' | 'small',
    size?: string,
};

export type HtmlAgentThoughtProps = {
    content?: BlockMap;
    stage?: string;
    onRenderEnd?: () => void;
    onWidgetEvent?: (event: { source: string; action: string; payload?: unknown; event?: Event }) => void;
    onClick?: (event: Event) => void;
    onPipelineComplete?: (event?: Event) => void;
    isHistory?: boolean
    isSingleAgent?: boolean
};

export type HtmlResultCardData = {
    fileType: string;
    title: string;
    labels: string[];
    coverUrls: string[];
    btnList: { text: string; action: string }[];
    raw: Record<string, unknown>;
};

export type CodeGenThoughtContent = {
    tool_call_response?: {
        data?: Array<{ code_str?: string; code_end?: boolean; code_lang?: string; cover_urls?: string[] }>;
    };
};

export type ThoughtsShape = { thought_type?: string; content?: unknown };

export type AgentFileMetaTypes = Partial<{
    agent_sub_type: string;
    bucket: string;
    bucket_object: string;
    code_lang: string;
    down_load_cover_url: string;
    cover_url: string;
    funcsource: string;
    mind_callback_doc_id: string;
    mind_callback_file_name: string;
    mind_callback_file_subtype: string;
    'netdisk.category': string;
    'netdisk.filename': string;
    'netdisk.fsid': string;
    'netdisk.parent_path': string;
    'netdisk.path': string;
    'netdisk.file_size': string;
    precode: string;
    query: string;
    query_id: string;
    share_url: string;
    tool_call_id: string;
}>

// type config = Partial<{
//     disable_parse: boolean;
// }>

export type AgentFileResultTypes = Partial<{
    file_id: string;
    name: string;
    size: number;
    file_type: number;
    status: number;
    meta: AgentFileMetaTypes;
    source: number;
    url: string;
    word_num: number;
    create_time: number;
    update_time: number;
    bdjson_url: string;
    md_url: string;
    title: string;
    editable: boolean;
    config: string;
    download_url: string;
    commit_status: number;
    hit_risk: boolean;
    download_status: number;
    edit_status: number;
    parent_id: string;
}>



export type UploadFileInfo = Partial<{
    category: number;
    ctime: number;
    from_type: number;
    fs_id: number;
    isdir: number;
    md5: string;
    mtime: number;
    path: string;
    server_filename: string;
    size: number;
    errno: number;
    name: string;
}>

export type WidgetEvent = {
    type?: string;
    source?: string;
    payload?: {
        item?: { [key: string]: unknown }
        index?: number
        expand?: () => void
        collapse?: () => void
        list?: [{ [key: string]: unknown }]
    }
    action?: string
}
