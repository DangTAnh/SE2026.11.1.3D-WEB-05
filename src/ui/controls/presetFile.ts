/** Shared by the actual file input and controlled deferred-promise tests. */
export function createPresetFileReader(
  importText: (text: string) => void,
  notify: (message: string, tone?: 'error') => void,
) {
  let request = 0;
  return {
    invalidate(): void { request++; },
    async read(file: Pick<File, 'size' | 'text'>): Promise<boolean> {
      const id = ++request;
      try {
        if (file.size === 0) throw new Error('Tệp preset rỗng.');
        if (file.size > 1_000_000) throw new Error('Tệp preset vượt quá giới hạn 1 MB.');
        const text = await file.text();
        if (id !== request) return false;
        importText(text);
        notify('Đã nhập preset hợp lệ.');
      } catch (error) {
        if (id !== request) return false;
        notify(error instanceof Error ? error.message : 'Không thể đọc preset.', 'error');
      }
      return id === request;
    },
  };
}
