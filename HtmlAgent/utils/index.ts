import { AgentFileResultTypes } from '@chat/components/Agent/HtmlAgent/types';

export const handleFileInfo = (value: AgentFileResultTypes) => {
  const fileInfo = {
    fsid: Number(value?.meta?.['netdisk.fsid']),
    category: Number(value?.meta?.['netdisk.category']),
    filename: value?.meta?.['netdisk.filename'] as string,
    parent_path: value?.meta?.['netdisk.parent_path'] as string,
    path: value?.meta?.['netdisk.path'] as string,
    size: Number(value?.meta?.['netdisk.file_size'] || 0) as number,
  };

  const data = {
    ...value,
    ...value?.meta,
    ...fileInfo,
  };

  return data;
};

/**
 * 安全解码函数
 * @param str
 * @returns
 */
export function safeDecode(str: string) {
  try {
    return decodeURIComponent(str);
  } catch {
    return str; // 解码失败就返回原值
  }
}