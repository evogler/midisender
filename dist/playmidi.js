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
    /* returns newLatestEndingNote */
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
const scheduleNotes = (data, notePos, latestEndingNote, config, timeouts, mainLoopTimeout, output, overallStartTime, finishCallback) => {
    console.log('scheduleNotes()');
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
        mainLoopTimeout.timeout = setTimeout(() => scheduleNotes(data, notePos, newLatestEndingNote, config, timeouts, mainLoopTimeout, output, overallStartTime, finishCallback), bufferIncrement);
    }
    else {
        mainLoopTimeout.timeout = setTimeout(() => {
            finishCallback();
            // setTimeout(() => process.exit(), 100);
        }, latestEndingNote - now() + 100);
    }
};
const killAllNotes = (data, timeouts, output, mainLoopTimeout) => {
    console.log('KILL ALL NOTES!');
    if (mainLoopTimeout.timeout) {
        clearTimeout(mainLoopTimeout.timeout);
    }
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
        clearTimeout(timeouts.get(key));
        timeouts.delete(key);
    });
    console.log('done clearing timeouts');
};
const listenForQuit = (killLiveNotes) => {
    console.log('Playing. Press "q" to quit.');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const handleInput = (input) => {
        if (input.toString() === "q") {
            killLiveNotes();
        }
    };
    process.stdin.on("data", handleInput);
};
export const play = async (data, finishCallback = () => { }) => {
    console.log('play()');
    const config = {
        bufferSize: 500,
        bufferIncrement: 100, // ms
    };
    const overallStartTime = now();
    const output = new easymidi.Output("my-midi-output", true);
    const latestEndingNote = now();
    const timeouts = new Map();
    const mainLoopTimeout = { timeout: null };
    scheduleNotes(data, 0, latestEndingNote, config, timeouts, mainLoopTimeout, output, overallStartTime, finishCallback);
    const killLiveNotes = () => {
        killAllNotes(data, timeouts, output, mainLoopTimeout);
        finishCallback();
    };
    return killLiveNotes;
};
export const main = async () => {
    const data = await getDataFromFilenameFromPrompt();
    const killLiveNotes = await play(data, () => process.stdin.pause());
    listenForQuit(killLiveNotes);
};
