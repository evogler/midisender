import subprocess
import json

'''
// const choice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// const scale = (key: number) =>
//   [0, 2, 4, 7, 9]
//     .map((i) => (((key + i) % 12) + 12) % 12)
//     .sort((a, b) => a - b);

// const randOctave = () => choice([3, 4, 5, 6, 7]) * 12;

// const data: MusicData = {
//   bpm: 100,
//   notes: [],
// };

// let chordTime = 0;

// for (let i = 0; i < 17; i++) {
//   const newNotes = [];
//   for (let j = 0; j < 16; j++) {
//     const p = choice(scale(~~(-i / 2))) + randOctave();
//     if (!newNotes.includes(p)) {
//       newNotes.push(p);
//     }
//   }

//   newNotes.sort((a, b) => a - b);
//   for (let j = 0; j < 16; j++) {
//     data.notes.push({
//       pitch: newNotes[j],
//       velocity: 50 + i * 3,
//       channel: 1,
//       time: chordTime + j / 24,
//       duration: 0.15,
//     });
//   }

//   chordTime += choice([0.5, 0.75, 1.5]);
// }

// const jsonData = JSON.stringify(data);
// fs.writeFileSync("./notes.txt", jsonData);
'''



with open('notes.txt', 'w') as f:
    f.write(str(notes))

subprocess.run(['node', 'playmidi.js'])

print('music over')

