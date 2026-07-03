/** Line icons drawn for this app; 24×24, stroked with currentColor. */
const wrap = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  new: wrap(
    '<rect x="3.5" y="5" width="11" height="15" rx="2"/><path d="M9 2.8 h8.5 a2 2 0 0 1 2 2 V17"/><path d="M9 10.5 v5 M6.5 13 h5"/>',
  ),
  undo: wrap('<path d="M8 5 3.5 9.5 8 14"/><path d="M4 9.5 h10a6 6 0 0 1 0 12h-3"/>'),
  redo: wrap('<path d="M16 5 20.5 9.5 16 14"/><path d="M20 9.5 h-10a6 6 0 0 0 0 12h3"/>'),
  hint: wrap(
    '<path d="M12 3a6.5 6.5 0 0 1 4 11.6c-.9.7-1.5 1.5-1.5 2.4h-5c0-.9-.6-1.7-1.5-2.4A6.5 6.5 0 0 1 12 3Z"/><path d="M9.8 20h4.4"/>',
  ),
  menu: wrap('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: wrap('<path d="M6 6l12 12M18 6L6 18"/>'),
  finish: wrap(
    '<path d="M12 3l2 5.4L20 9l-4.6 3.6L17 19l-5-3.2L7 19l1.6-6.4L4 9l6-0.6Z"/>',
  ),
} as const;

export type IconName = keyof typeof ICONS;
