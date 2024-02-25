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
const scheduleNote = (bpm, note, noteId, latestEndingNote, config, timeouts, output, overallStartTime) => {
    // returns newLatestEndingNote
    const startTime = realTime(bpm)(note.time) + overallStartTime + config.bufferSize;
    const endTime = realTime(bpm)(note.time + note.duration) +
        overallStartTime +
        config.bufferSize;
    const newLatestEndingNote = Math.max(latestEndingNote, endTime);
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
    return newLatestEndingNote;
};
const killAllNotes = (data, timeouts, output) => {
    timeouts.forEach((_, key) => {
        const [noteId, eventType] = key.split(",");
        if (eventType === "noteoff") {
            const note = data.notes[parseInt(noteId)];
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
const finish = (data, timeouts, output) => {
    killAllNotes(data, timeouts, output);
    process.exit(0);
};
const scheduleNotes = (data, notePos, latestEndingNote, config, timeouts, output, overallStartTime) => {
    const { bufferSize, bufferIncrement } = config;
    const timeWindowEnd = now() + bufferSize - overallStartTime;
    let newLatestEndingNote = latestEndingNote;
    while (notePos < data.notes.length &&
        realTime(data.bpm)(data.notes[notePos].time) < timeWindowEnd) {
        const note = data.notes[notePos];
        newLatestEndingNote = scheduleNote(data.bpm, note, notePos, latestEndingNote, config, timeouts, output, overallStartTime);
        notePos += 1;
    }
    if (notePos < data.notes.length) {
        setTimeout(() => scheduleNotes(data, notePos, newLatestEndingNote, config, timeouts, output, overallStartTime), bufferIncrement);
    }
    else {
        setTimeout(finish, latestEndingNote - now() + 100);
    }
};
const listenForQuit = (onQuit) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (input) => {
        if (input.toString() === "q") {
            onQuit();
        }
    });
};
export const play = async (data) => {
    const config = {
        bufferSize: 1000,
        bufferIncrement: 100, // ms
    };
    const overallStartTime = now();
    const output = new easymidi.Output("my-midi-output", true);
    const latestEndingNote = now();
    const timeouts = new Map();
    console.log('Playing. Press "q" to quit.');
    scheduleNotes(data, 0, latestEndingNote, config, timeouts, output, overallStartTime);
    const onQuit = () => finish(data, timeouts, output);
    listenForQuit(onQuit);
};
export const main = async () => {
    const data = await getDataFromFilenameFromPrompt();
    play(data);
};