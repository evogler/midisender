export interface Note {
    pitch: number;
    velocity: number;
    channel: number;
    time: number;
    duration: number;
}
export interface MusicData {
    bpm: number;
    notes: Note[];
}
export declare const play: (data: MusicData, finishCallback?: () => void) => Promise<() => void>;
export declare const main: () => Promise<void>;
