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
export declare const main: () => Promise<void>;
