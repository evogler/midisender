import * as easymidi from "easymidi";
import { Output, Note as EasymidiNote } from "easymidi";
import { readFile } from "fs/promises";

// types

interface Note {
  pitch: number;
  velocity: number;
  channel: number;
  time: number;
  duration: number;
}

interface MusicData {
  bpm: number;
  notes: Note[];
}

type EventType = "noteon" | "noteoff";

type Timeouts = Map<string, NodeJS.Timeout>;

type Config = {
  bufferSize: number;
  bufferIncrement: number;
  overallStartTime: number;
};

// functions

const getDataFromFilenameFromPrompt = async (): Promise<MusicData> => {
  const filename = process.argv[2];

  if (filename === undefined) {
    console.log("Usage: node playmidi.js <midi-json-file>");
    process.exit(1);
  }
  const data = JSON.parse(await readFile(filename, "utf8"));
  data.notes.sort((a: Note, b: Note) => a.time - b.time);
  return data;
};

const realTime = (bpm: number) => (time: number) => time * (60 / bpm) * 1000;

const now = (): number => ((t) => (t[0] + t[1] / 1e9) * 1000)(process.hrtime());

const scheduleNote = (
  bpm: number,
  note: Note,
  time0: number,
  noteId: number,
  latestEndingNote: number,
  config: Config,
  timeouts: Timeouts,
  output: Output
): number => {
  const startTime = realTime(bpm)(note.time) + time0 + config.bufferSize;
  const endTime =
    realTime(bpm)(note.time + note.duration) + time0 + config.bufferSize;
  const newLatestEndingNote = Math.max(latestEndingNote, endTime);
  const { pitch, channel, velocity } = note;

  timeouts.set(
    [noteId, "noteon"].toString(),
    setTimeout(() => {
      output.send("noteon", { note: pitch, channel, velocity } as EasymidiNote);
      timeouts.delete([noteId, "noteon"].toString());
    }, startTime - now())
  );

  timeouts.set(
    [noteId, "noteoff"].toString(),
    setTimeout(() => {
      output.send("noteoff", {
        note: pitch,
        channel,
        velocity,
      } as EasymidiNote);
      timeouts.delete([noteId, "noteoff"].toString());
    }, endTime - now())
  );

  return newLatestEndingNote;
};

const killAllNotes = (data: MusicData, timeouts: Timeouts, output: Output) => {
  timeouts.forEach((timeout, key) => {
    const [noteId, eventType] = key.split(",");
    if (eventType === "noteoff") {
      const note = data.notes[parseInt(noteId)];
      output.send("noteoff", {
        note: note.pitch,
        channel: note.channel,
        velocity: note.velocity,
      } as EasymidiNote);
    } else if (eventType === "noteon") {
      clearTimeout(timeouts.get(key));
    }
    timeouts.delete(key);
  });
};

const finish = (data: MusicData, timeouts: Timeouts, output: Output) => {
  killAllNotes(data, timeouts, output);
  process.exit(0);
};

const scheduleNotes = (
  data: MusicData,
  notePos: number,
  latestEndingNote: number,
  config: Config,
  timeouts: Timeouts,
  output: Output
) => {
  const { bufferSize, bufferIncrement, overallStartTime } = config;
  const timeWindowEnd = now() + bufferSize - overallStartTime;
  let newLatestEndingNote = latestEndingNote;
  while (
    notePos < data.notes.length &&
    realTime(data.bpm)(data.notes[notePos].time) < timeWindowEnd
  ) {
    const note = data.notes[notePos];
    latestEndingNote = scheduleNote(
      data.bpm,
      note,
      overallStartTime,
      notePos,
      latestEndingNote,
      config,
      timeouts,
      output
    );
    notePos += 1;
  }
  if (notePos < data.notes.length) {
    setTimeout(
      () =>
        scheduleNotes(
          data,
          notePos,
          latestEndingNote,
          config,
          timeouts,
          output
        ),
      bufferIncrement
    );
  } else {
    setTimeout(finish, latestEndingNote - now() + 100);
  }
};

const listenForQuit = (data: MusicData, timeouts: Timeouts, output: Output) => {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("data", (input) => {
    if (input.toString() === "q") {
      finish(data, timeouts, output);
    }
  });
};

export const main = async () => {
  const bufferSize = 1000; // milliseconds
  const bufferIncrement = 100; // milliseconds
  const overallStartTime = now();
  const config: Config = { bufferSize, bufferIncrement, overallStartTime };

  const output = new easymidi.Output("arstneio", true);
  let latestEndingNote = now();
  const timeouts = new Map<string, NodeJS.Timeout>();

  console.log('Playing. Press "q" to quit.');
  const data = await getDataFromFilenameFromPrompt();
  scheduleNotes(data, 0, latestEndingNote, config, timeouts, output);
  listenForQuit(data, timeouts, output);
};

// main();
