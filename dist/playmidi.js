import * as easymidi from "easymidi";
import { readFile } from "fs/promises";
const getDataFromFilenameFromPrompt = async () => {
    const filename = process.argv[2];
    if (filename === undefined) {
        console.log("Usage: node playmidi.js <midi-json-file>");
        process.exit(1);
    }
    const data = JSON.parse(await readFile(filename, "utf8"));
    data.notes.sort((a, b) => a.time - b.time);
    return data;
};
const realTime = (bpm) => (time) => time * (60 / bpm) * 1000;
const now = () => ((t) => (t[0] + t[1] / 1e9) * 1000)(process.hrtime());
export class MidiPlayer {
    constructor(data, finishCallback) {
        this.data = data;
        this.notePos = 0;
        this.timeouts = new Map();
        this.output = new easymidi.Output("my-midi-output", true);
        this.config = {
            bufferSize: 500,
            bufferIncrement: 100, // ms
        };
        this.mainLoopTimeout = { timeout: null, keepRunning: true };
        this.finishCallback = finishCallback;
        this.overallStartTime = now();
        this.startBeat = 0;
        this.latestEndingNote = 0;
    }
    scheduleNote(note, noteId) {
        /* returns newLatestEndingNote */
        const startTime = realTime(this.data.bpm)(note.time - this.startBeat) +
            this.overallStartTime +
            this.config.bufferSize;
        const endTime = realTime(this.data.bpm)(note.time + note.duration - this.startBeat) +
            this.overallStartTime +
            this.config.bufferSize;
        this.latestEndingNote = Math.max(this.latestEndingNote, endTime);
        const { pitch, channel, velocity, callbackId } = note;
        this.timeouts.set([noteId, "noteon", `pitch: ${pitch}`].toString(), setTimeout(() => {
            this.output.send("noteon", {
                note: pitch,
                channel,
                velocity,
            });
            this.timeouts.delete([noteId, "noteon"].toString());
            if (callbackId !== undefined && this.eventCallback !== undefined) {
                this.eventCallback({ id: callbackId, status: "noteon" });
            }
        }, startTime - now()));
        this.timeouts.set([noteId, "noteoff", `pitch: ${pitch}`].toString(), setTimeout(() => {
            this.output.send("noteoff", {
                note: pitch,
                channel,
                velocity,
            });
            this.timeouts.delete([noteId, "noteoff"].toString());
            if (callbackId !== undefined && this.eventCallback !== undefined) {
                this.eventCallback({ id: callbackId, status: "noteoff" });
            }
        }, endTime - now()));
    }
    scheduleNotes() {
        if (!this.mainLoopTimeout.keepRunning) {
            return;
        }
        const timeWindowStart = now() - this.overallStartTime;
        const timeWindowEnd = now() + this.config.bufferSize - this.overallStartTime;
        while (this.notePos < this.data.notes.length) {
            const noteRealTime = realTime(this.data.bpm)(this.data.notes[this.notePos].time - this.startBeat);
            if (!(noteRealTime < timeWindowEnd)) {
                break;
            }
            if (noteRealTime + this.config.bufferSize < timeWindowStart) {
                this.notePos += 1;
                continue;
            }
            const note = this.data.notes[this.notePos];
            this.scheduleNote(note, this.notePos);
            this.notePos += 1;
        }
        if (this.notePos < this.data.notes.length) {
            this.mainLoopTimeout.timeout = setTimeout(() => this.scheduleNotes(), this.config.bufferIncrement);
        }
        else {
            this.mainLoopTimeout.timeout = setTimeout(() => {
                this.finishCallback();
            }, this.latestEndingNote - now() + 100);
        }
    }
    killScheduledNotes() {
        this.timeouts.forEach((_, key) => {
            const [noteId, eventType] = key.split(",");
            if (eventType === "noteoff") {
                const note = this.data.notes[parseInt(noteId)];
                this.output.send("noteoff", {
                    note: note.pitch,
                    channel: note.channel,
                    velocity: note.velocity,
                });
            }
            clearTimeout(this.timeouts.get(key));
            this.timeouts.delete(key);
        });
    }
    listenForKeyboardInput(updateNotes) {
        console.log('Playing. Press "q" to quit.');
        process.stdin.setRawMode(true);
        process.stdin.resume();
        const handleInput = (input) => {
            if (input.toString() === "q") {
                this.killAndFinish();
            }
            else if (input.toString() === "u") {
                updateNotes();
            }
        };
        process.stdin.on("data", handleInput);
    }
    swapInData(newData) {
        this.killScheduledNotes();
        this.data = newData;
        this.notePos = 0;
    }
    killAndFinish() {
        this.killScheduledNotes();
        this.mainLoopTimeout.keepRunning = false;
        if (this.mainLoopTimeout.timeout) {
            clearTimeout(this.mainLoopTimeout.timeout);
        }
        this.finishCallback();
    }
    updateBpm(bpm) {
        const oldBpm = this.data.bpm;
        const newOverallStartTime = now();
        const timeElapsed = newOverallStartTime - this.overallStartTime;
        const newStartBeat = this.startBeat + (timeElapsed * (oldBpm / 60)) / 1000;
        this.overallStartTime = newOverallStartTime;
        this.startBeat = newStartBeat;
        this.data.bpm = bpm;
        this.swapInData({ ...this.data, bpm });
    }
    setEventCallback(callback) {
        this.eventCallback = callback;
    }
    async play() {
        this.latestEndingNote = now();
        this.scheduleNotes();
    }
}
export const main = async () => {
    const data = await getDataFromFilenameFromPrompt();
    const player = new MidiPlayer(data, () => process.stdin.pause());
    player.setEventCallback(({ id, status }) => {
        console.log(`${status}: ${id}`);
    });
    await player.play();
    player.listenForKeyboardInput(() => {
        console.log("update triggered.");
        player.updateBpm(Math.random() * 150 + 50);
    });
};
