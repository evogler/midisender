import * as easymidi from "easymidi";
import { readFile } from "fs/promises";
const filename = process.argv[2];
if (filename === undefined) {
    console.log("Usage: node playmidi.js <midi-json-file>");
    process.exit(1);
}
const data = JSON.parse(await readFile(filename, "utf8"));
const output = new easymidi.Output("arstneio", true);
const realTime = (bpm) => (time) => time * (60 / bpm) * 1000;
data.notes.sort((a, b) => a.time - b.time);
const bufferSize = 1000; // milliseconds
const bufferIncrement = 100; // milliseconds
const now = () => ((t) => (t[0] + t[1] / 1e9) * 1000)(process.hrtime());
const overallStartTime = now();
let latestEndingNote = now();
const timeouts = new Map();
const scheduleNote = (note, time0, noteId) => {
    const startTime = realTime(data.bpm)(note.time) + time0 + bufferSize;
    const endTime = realTime(data.bpm)(note.time + note.duration) + time0 + bufferSize;
    latestEndingNote = Math.max(latestEndingNote, endTime);
    const { pitch, channel, velocity } = note;
    timeouts.set([noteId, "noteon"].toString(), setTimeout(() => {
        output.send("noteon", { note: pitch, channel, velocity });
        timeouts.delete([noteId, "noteon"].toString());
    }, startTime - now()));
    timeouts.set([noteId, "noteoff"].toString(), setTimeout(() => {
        output.send("noteoff", {
            note: pitch,
            channel,
            velocity,
        });
        timeouts.delete([noteId, "noteoff"].toString());
    }, endTime - now()));
};
const killAllNotes = () => {
    timeouts.forEach((timeout, key) => {
        const [noteId, eventType] = key.split(",");
        if (eventType === "noteoff") {
            const note = data.notes[noteId];
            output.send("noteoff", {
                note: note.pitch,
                channel: note.channel,
                velocity: note.velocity,
            });
        }
        else if (eventType === "noteon") {
            clearTimeout(timeouts.get(key));
        }
        timeouts.delete(key);
    });
};
const finish = () => {
    killAllNotes();
    process.exit(0);
};
const scheduleNotes = (notePos = 0) => {
    const timeWindowEnd = now() + bufferSize - overallStartTime;
    while (notePos < data.notes.length &&
        realTime(data.bpm)(data.notes[notePos].time) < timeWindowEnd) {
        const note = data.notes[notePos];
        scheduleNote(note, overallStartTime, notePos);
        notePos += 1;
    }
    if (notePos < data.notes.length) {
        setTimeout(() => scheduleNotes(notePos), bufferIncrement);
    }
    else {
        setTimeout(finish, latestEndingNote - now() + 100);
    }
};
const listenForQuit = () => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (input) => {
        if (input.toString() === "q") {
            finish();
        }
    });
};
export const main = () => {
    console.log('Playing. Press "q" to quit.');
    scheduleNotes(0);
    listenForQuit();
};
// main();
