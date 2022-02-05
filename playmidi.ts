const fs = require("fs");
const easymidi = require("easymidi");

const output = new easymidi.Output("arstneio", true);

const filename = process.argv[2];
if (filename === undefined) {
  console.log("Usage: node playmidi.js <midi-file>");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filename, "utf8"));

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

const realTime = (bpm: number) => (time: number) => time * (60 / bpm) * 1000;

data.notes.sort((a, b) => a.time - b.time);
const soundingNotes: Record<number, number> = {};
let playing = true;

const bufferSize = 1000; // milliseconds
const bufferIncrement = 100; // milliseconds

const now = (): number => ((t) => (t[0] + t[1] / 1e9) * 1000)(process.hrtime());
const overallStartTime = now();

const scheduleNote = (note: Note, time0: number) => {
  const startTime = realTime(data.bpm)(note.time) + time0 + bufferSize;
  const endTime =
    realTime(data.bpm)(note.time + note.duration) + time0 + bufferSize;
  const { pitch, channel, velocity } = note;
  setTimeout(() => {
    if (!playing) return;
    output.send("noteon", { note: pitch, channel, velocity });
    soundingNotes[note.pitch] = (soundingNotes[note.pitch] || 0) + 1;
  }, startTime - now());
  setTimeout(() => {
    if (!playing) return;
    soundingNotes[note.pitch] = soundingNotes[note.pitch] - 1;
    if (soundingNotes[note.pitch] <= 0) {
      delete soundingNotes[note.pitch];
      output.send("noteoff", { note: pitch, channel, velocity });
    }
  }, endTime - now());
};

const killAllNotes = () => {
  // for (const note of Object.keys(soundingNotes)) {
  for (let reps = 0; reps < 10; reps++) {
    for (let i = 0; i < 128; i++) {
      output.send("noteoff", { note: i, channel: 1, velocity: 0 });
    }
  }
};

const scheduleNotes = (notePos = 0, timeWindowStart = 0) => {
  const timeWindowEnd = timeWindowStart + bufferSize;
  while (
    notePos < data.notes.length &&
    realTime(data.bpm)(data.notes[notePos].time) < timeWindowEnd
  ) {
    const note = data.notes[notePos];
    scheduleNote(note, overallStartTime);
    notePos += 1;
  }
  if (notePos < data.notes.length) {
    setTimeout(
      () => scheduleNotes(notePos, timeWindowStart + bufferIncrement),
      bufferIncrement
    );
  } else {
    setTimeout(() => {
      console.log("done");
      killAllNotes();
      setTimeout(() => process.exit(0), 1000);
    }, 1000);
  }
};

const listenForQuit = () => {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("data", (input) => {
    if (input.toString() === "q") {
      playing = false;
      killAllNotes();
      setTimeout(() => process.exit(0), 1000);
    }
  });
};

const main = () => {
  killAllNotes();
  scheduleNotes(0);
  listenForQuit();
}

main();
