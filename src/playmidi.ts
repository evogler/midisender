import * as easymidi from "easymidi";
import { Output, Note as EasymidiNote } from "easymidi";
import { readFile } from "fs/promises";
import { kill } from "process";

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
};

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
  noteId: number,
  latestEndingNote: number,
  config: Config,
  timeouts: Timeouts,
  output: Output,
  overallStartTime: number
): number => {
  /* returns newLatestEndingNote */

  const startTime =
    realTime(bpm)(note.time) + overallStartTime + config.bufferSize;
  const endTime =
    realTime(bpm)(note.time + note.duration) +
    overallStartTime +
    config.bufferSize;
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

const scheduleNotes = (
  data: MusicData,
  notePos: number,
  latestEndingNote: number,
  config: Config,
  timeouts: Timeouts,
  mainLoopTimeout: { timeout: NodeJS.Timeout | null },
  output: Output,
  overallStartTime: number,
  finishCallback: () => void
) => {
  const { bufferSize, bufferIncrement } = config;
  const timeWindowEnd = now() + bufferSize - overallStartTime;
  let newLatestEndingNote = latestEndingNote;
  while (
    notePos < data.notes.length &&
    realTime(data.bpm)(data.notes[notePos].time) < timeWindowEnd
  ) {
    const note = data.notes[notePos];
    newLatestEndingNote = scheduleNote(
      data.bpm,
      note,
      notePos,
      latestEndingNote,
      config,
      timeouts,
      output,
      overallStartTime
    );
    notePos += 1;
  }
  if (notePos < data.notes.length) {
    mainLoopTimeout.timeout = setTimeout(
      () =>
        scheduleNotes(
          data,
          notePos,
          newLatestEndingNote,
          config,
          timeouts,
          mainLoopTimeout,
          output,
          overallStartTime,
          finishCallback
        ),
      bufferIncrement
    );
  } else {
    mainLoopTimeout.timeout = setTimeout(() => {
      finishCallback();
      // setTimeout(() => process.exit(), 100);
    }, latestEndingNote - now() + 100);
  }
};

const killAllNotes = (
  data: MusicData,
  timeouts: Timeouts,
  output: Output,
  mainLoopTimeout: { timeout: NodeJS.Timeout | null }
) => {
  console.log('KILL ALL NOTES!')
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
      } as EasymidiNote);
    }
    clearTimeout(timeouts.get(key));
    timeouts.delete(key);
  });
  console.log('done clearing timeouts')
};

const listenForQuit = (killLiveNotes: () => void) => {
  console.log('Playing. Press "q" to quit.');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  const handleInput = (input: Buffer) => {
    if (input.toString() === "q") {
      killLiveNotes();
    }
  };
  process.stdin.on("data", handleInput);
};

export const play = async (
  data: MusicData,
  finishCallback = () => {}
): Promise<() => void> => {
  const config: Config = {
    bufferSize: 1000, // ms
    bufferIncrement: 100, // ms
  };
  const overallStartTime = now();
  const output = new easymidi.Output("my-midi-output", true);
  const latestEndingNote = now();
  const timeouts = new Map<string, NodeJS.Timeout>();
  const mainLoopTimeout = { timeout: null };

  scheduleNotes(
    data,
    0,
    latestEndingNote,
    config,
    timeouts,
    mainLoopTimeout,
    output,
    overallStartTime,
    finishCallback
  );

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
