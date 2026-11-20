export type MediaKind = 'video' | 'audio';
export type PlayerView = 'video' | 'artwork' | 'compact';

export const defaultView = (kind: MediaKind): PlayerView => kind === 'video' ? 'video' : 'artwork';

export interface MediaChoice {
  id: number;
  kind: MediaKind;
  title: string;
  playing: boolean;
  view?: PlayerView;
  upNext?: string;
}

export interface MediaScan {
  choices: MediaChoice[];
  embedUrl?: string;
}

export interface OpenResult {
  status: 'opened' | 'gesture' | 'error';
  message?: string;
  reason?: 'site-opt-out';
}

export type PlayerRequest =
  | { detached: 'scan' }
  | { detached: 'open'; mediaId: number; view: PlayerView; overrideSiteOptOut?: boolean };
