export type MediaKind = 'video' | 'audio';

export interface MediaChoice {
  id: number;
  kind: MediaKind;
  title: string;
  playing: boolean;
}

export interface MediaScan {
  choices: MediaChoice[];
  embedUrl?: string;
}

export interface OpenResult {
  status: 'opened' | 'gesture' | 'error';
  message?: string;
}

export type PlayerRequest =
  | { detached: 'scan' }
  | { detached: 'open'; mediaId: number };
