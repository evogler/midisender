/// <reference types="node" />
import * as easymidi from "easymidi";
export interface Note {
    pitch: number;
    velocity: number;
    channel: number;
    time: number;
    duration: number;
    callbackId?: number;
}
export interface MusicData {
    bpm: number;
    notes: Note[];
}
export declare type EventCallbackData = {
    id: number;
    status: "noteon" | "noteoff";
};
declare type Config = {
    bufferSize: number;
    bufferIncrement: number;
};
export declare class MidiPlayer {
    data: MusicData;
    notePos: number;
    timeouts: Map<string, NodeJS.Timeout>;
    output: easymidi.Output;
    config: Config;
    mainLoopTimeout: {
        timeout: NodeJS.Timeout | null;
        keepRunning: boolean;
    };
    eventCallback?: ({ id, status }: EventCallbackData) => void;
    finishCallback: () => void;
    overallStartTime: number;
    startBeat: number;
    latestEndingNote: number;
    constructor(data: MusicData, finishCallback: () => void);
    private scheduleNote;
    private scheduleNotes;
    killScheduledNotes(): void;
    listenForKeyboardInput(updateNotes: () => void): void;
    swapInData(newData: MusicData): void;
    killAndFinish(): void;
    updateBpm(bpm: number): void;
    setEventCallback(callback: (data: EventCallbackData) => void): void;
    play(): Promise<void>;
}
export declare const main: () => Promise<void>;
export {};
