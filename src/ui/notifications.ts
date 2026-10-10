import { byId } from './dom.ts';

export type ToastTone = 'success' | 'info' | 'error';

export function createToastController() {
  let timer: number | undefined;

  const notify = (message: string, tone: ToastTone = 'success') => {
    const toast = byId<HTMLDivElement>('toast');
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.classList.toggle('error', tone === 'error');
    toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    toast.hidden = false;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      toast.hidden = true;
      toast.setAttribute('role', 'status');
    }, 4500);
  };

  return { notify, dispose: () => window.clearTimeout(timer) };
}
