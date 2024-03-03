import * as easymidi from "easymidi";
import { Output, Note as EasymidiNote } from "easymidi";
import { readFile } from "fs/promises";
import { kill } from "process";

// types

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

type MusicDataContext = {
  data: MusicData;
  notePos: number;
  latestEndingNote: number;
};

// export type EasymidiEventType = "noteon" | "noteoff";

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
    [noteId, "noteon", `pitch: ${pitch}`].toString(),
    setTimeout(() => {
      output.send("noteon", { note: pitch, channel, velocity } as EasymidiNote);
      timeouts.delete([noteId, "noteon"].toString());
    }, startTime - now())
  );

  timeouts.set(
    [noteId, "noteoff", `pitch: ${pitch}`].toString(),
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
  musicDataContext: MusicDataContext,
  config: Config,
  timeouts: Timeouts,
  mainLoopTimeout: { timeout: NodeJS.Timeout | null; keepRunning: boolean },
  output: Output,
  overallStartTime: number,
  finishCallback: () => void
) => {
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
    newLatestEndingNote = scheduleNote(
      data.bpm,
      note,
      newNotePos,
      latestEndingNote,
      config,
      timeouts,
      output,
      overallStartTime
    );
    newNotePos += 1;
  }
  if (newNotePos < data.notes.length) {
    musicDataContext.latestEndingNote = newLatestEndingNote;
    musicDataContext.notePos = newNotePos;
    mainLoopTimeout.timeout = setTimeout(
      () =>
        scheduleNotes(
          musicDataContext,
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
  musicDataContext: MusicDataContext,
  timeouts: Timeouts,
  output: Output
) => {
  const { data } = musicDataContext;
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
};

const listenForKeyboardInput = (
  killLiveNotes: () => void,
  updateNotes: () => void
) => {
  console.log('Playing. Press "q" to quit.');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  const handleInput = (input: Buffer) => {
    if (input.toString() === "q") {
      killLiveNotes();
    } else if (input.toString() === "u") {
      updateNotes();
    }
  };
  process.stdin.on("data", handleInput);
};

export const play = async (
  data: MusicData,
  finishCallback = () => {}
): Promise<{
  killLiveNotes: () => void;
  swapInData: (data: MusicData) => void;
}> => {
  const config: Config = {
    bufferSize: 500, // ms
    bufferIncrement: 100, // ms
  };
  const overallStartTime = now();
  const output = new easymidi.Output("my-midi-output", true);
  const latestEndingNote = now();
  const timeouts = new Map<string, NodeJS.Timeout>();
  const mainLoopTimeout = { timeout: null, keepRunning: true };
  const musicDataContext = { data, notePos: 0, latestEndingNote };

  const swapInData = (newData: MusicData) => {
    killAllNotes(musicDataContext, timeouts, output);
    musicDataContext.data = newData;
    musicDataContext.notePos = 0;
  };
  scheduleNotes(
    musicDataContext,
    config,
    timeouts,
    mainLoopTimeout,
    output,
    overallStartTime,
    finishCallback
  );

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

  const { killLiveNotes, swapInData } = await play(data, () =>
    process.stdin.pause()
  );

  const swapData = { data: data2 };
  listenForKeyboardInput(killLiveNotes, () => {
    swapInData(swapData.data);
    const nextData = swapData.data === data2 ? data : data2;
    swapData.data = nextData;
  });
};
