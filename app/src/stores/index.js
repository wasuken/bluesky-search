import { writable, derived } from 'svelte/store';

export const isOpen = writable(false);
export const open = () => isOpen.update(t => true);
export const close = () => isOpen.update(t => false);

export const fileId = writable(-1);
export const fileIdUpdate = (id) => fileId.update(x => id);
