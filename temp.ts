import { fork } from "child_process";
import { writeFileSync } from "fs";

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

const notes: Note[] = [];

let time = 0;

const shuffle = <T>(array: T[]): T[] =>
  array.map((n: T): [number, T] => [Math.random(), n]).sort((a, b) => a[0] - b[0]).map(n => n[1]);

const range = (start: number, end: number): number[] => {
  const res: number[] = [];
  for (let i = start; i <= end; i++) {
    res.push(i);
  }
  return res;
};

const row = shuffle(range(48, 59));

let trans = 0;

for (let i = 0; i < 4000; i++) {
  if (Math.random() < .2) {
    trans = ~~(Math.random() * 12);
  }
  const pitches = [];
  const pLen = ~~(Math.random() * 10 * 2);
  const pStart = ~~(Math.random() * 10 * 2);
  for (let i = pLen; i < (pLen + pStart); i++) {
    pitches.push(row[i % row.length] + trans);
  }


  const duration = Math.random() * .2 + .2;
  for (const pitch of pitches) {
    const note = {
      pitch,
      velocity: 70,
      channel: 0,
      time: time,
      duration,
    };
    notes.push(note);
    time += duration;
  }
  time += .5 + Math.random();
}

const MusicData = { bpm: 120, notes };

writeFileSync("./notes.json", JSON.stringify(MusicData));

const child = fork("playmidi.js", ["notes.json"]);
