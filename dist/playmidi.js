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
    timeouts.set([noteId, "noteon", `pitch: ${pitch}`].toString(), setTimeout(() => {
        output.send("noteon", { note: pitch, channel, velocity });
        timeouts.delete([noteId, "noteon"].toString());
    }, startTime - now()));
    timeouts.set([noteId, "noteoff", `pitch: ${pitch}`].toString(), setTimeout(() => {
        output.send("noteoff", {
            note: pitch,
            channel,
            velocity,
        });
        timeouts.delete([noteId, "noteoff"].toString());
    }, endTime - now()));
    return newLatestEndingNote;
};
const scheduleNotes = (musicDataContext, config, timeouts, mainLoopTimeout, output, overallStartTime, finishCallback) => {
    if (!mainLoopTimeout.keepRunning) {
        return;
    }
    const { data, notePos, latestEndingNote } = musicDataContext;
    const { bufferSize, bufferIncrement } = config;
    const timeWindowStart = now() - overallStartTime;
    const timeWindowEnd = now() + bufferSize - overallStartTime;
    let newNotePos = notePos;
    let newLatestEndingNote = latestEndingNote;
    while (newNotePos < data.notes.length) {
        const noteRealTime = realTime(data.bpm)(data.notes[newNotePos].time);
        if (!(noteRealTime < timeWindowEnd)) {
            break;
        }
        if (noteRealTime + bufferSize < timeWindowStart) {
            newNotePos += 1;
            continue;
        }
        const note = data.notes[newNotePos];
        newLatestEndingNote = scheduleNote(data.bpm, note, newNotePos, latestEndingNote, config, timeouts, output, overallStartTime);
        newNotePos += 1;
    }
    if (newNotePos < data.notes.length) {
        musicDataContext.latestEndingNote = newLatestEndingNote;
        musicDataContext.notePos = newNotePos;
        mainLoopTimeout.timeout = setTimeout(() => scheduleNotes(musicDataContext, config, timeouts, mainLoopTimeout, output, overallStartTime, finishCallback), bufferIncrement);
    }
    else {
        mainLoopTimeout.timeout = setTimeout(() => {
            finishCallback();
            // setTimeout(() => process.exit(), 100);
        }, latestEndingNote - now() + 100);
    }
};
const killAllNotes = (musicDataContext, timeouts, output) => {
    const { data } = musicDataContext;
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
};
const listenForKeyboardInput = (killLiveNotes, updateNotes) => {
    console.log('Playing. Press "q" to quit.');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const handleInput = (input) => {
        if (input.toString() === "q") {
            killLiveNotes();
        }
        else if (input.toString() === "u") {
            updateNotes();
        }
    };
    process.stdin.on("data", handleInput);
};
export const play = async (data, finishCallback = () => { }) => {
    const config = {
        bufferSize: 2000,
        bufferIncrement: 100, // ms
    };
    const overallStartTime = now();
    const output = new easymidi.Output("my-midi-output", true);
    const latestEndingNote = now();
    const timeouts = new Map();
    const mainLoopTimeout = { timeout: null, keepRunning: true };
    const musicDataContext = { data, notePos: 0, latestEndingNote };
    const swapInData = (newData) => {
        killAllNotes(musicDataContext, timeouts, output);
        musicDataContext.data = newData;
        musicDataContext.notePos = 0;
    };
    scheduleNotes(musicDataContext, config, timeouts, mainLoopTimeout, output, overallStartTime, finishCallback);
    const killLiveNotes = () => {
        killAllNotes(musicDataContext, timeouts, output);
        mainLoopTimeout.keepRunning = false;
        if (mainLoopTimeout.timeout) {
            clearTimeout(mainLoopTimeout.timeout);
        }
        finishCallback();
    };
    return { killLiveNotes, swapInData };
};
export const main = async () => {
    const data = await getDataFromFilenameFromPrompt();
    const data2 = {
        ...data,
        notes: data.notes.map((note) => ({
            ...note,
            pitch: note.pitch + 24,
            // time: note.time * 2,
            // duration: note.duration * 2,
        })),
    };
    const { killLiveNotes, swapInData } = await play(data, () => process.stdin.pause());
    const swapData = { data: data2 };
    listenForKeyboardInput(killLiveNotes, () => {
        swapInData(swapData.data);
        const nextData = swapData.data === data2 ? data : data2;
        swapData.data = nextData;
    });
};
