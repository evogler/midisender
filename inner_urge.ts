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

enum ChordType {
  DOR,
  LYD,
  MIX,
  AEOL,
}

const { LYD, MIX, DOR, AEOL } = ChordType;

const ChordNotes: Record<ChordType, number[]> = {
  [DOR]: [0, 3, 7, 9],
  [LYD]: [0, 4, 6, 11],
  [MIX]: [0, 4, 9, 10],
  [AEOL]: [0, 3, 7, 8],
};

const ChordTypeRoots: Record<ChordType, number> = {
  [DOR]: 2,
  [LYD]: 5,
  [MIX]: 7,
  [AEOL]: 9,
};

type Chord = [number, typeof ChordType[keyof typeof ChordType]];

const innerUrge: Chord[] = [
  [4, LYD],
  [1, LYD],
  [2, LYD],
  [11, LYD],
  [0, LYD],
  [9, LYD],
  [10, LYD],
  [7, LYD],
];

const relativeChord = (chord: Chord, newType: ChordType): Chord => {
  const [root, type] = chord;
  const newRoot =
    (ChordTypeRoots[newType] - ChordTypeRoots[type] + root + 12) % 12;
  return [newRoot, newType];
};

const voiceChord = (chord: Chord): number[] => {
  const [root, type] = chord;
  const chordNotes = ChordNotes[type].map((n) => (n + root) % 12);
  chordNotes[0] -= 24;
  return chordNotes;
};

const choice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// const pattern: (ChordType | "")[] = [DOR, MIX, DOR, DOR, LYD, DOR, LYD, DOR];
const pattern: (ChordType | "")[] = ['', '', '', '', '', '', '', ''];

const reharmChords = innerUrge.map((chord, i) => {
  const match = pattern[i] !== "";
  const cType = match ? (pattern[i] as ChordType) : choice([LYD, MIX, DOR, AEOL]);
  return relativeChord(chord, cType);
});

console.log(reharmChords);

const notes: Note[] = [];

let time = 0;

for (let choruses = 0; choruses < 40; choruses++) {
  for (let i = 0; i < reharmChords.length; i++) {
    const chord = reharmChords[i];
    const chordNotes = voiceChord(chord);
    const duration = 2;
    const transpose = 60;
    for (let j = 0; j < chordNotes.length; j++) {
      const note = {
        pitch: chordNotes[j] + transpose,
        velocity: 70,
        channel: 0,
        time: time,
        duration: duration,
      };
      notes.push(note);
    }
    time += duration;
  }
}

const MusicData = { bpm: 120, notes };

writeFileSync("./notes.json", JSON.stringify(MusicData));

const child = fork("playmidi.js", ["notes.json"]);
