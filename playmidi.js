const fs = require("fs");
const easymidi = require("easymidi");

const BUFFER_SIZE = 1000; // milliseconds
const BUFFER_INCREMENT = 100; // milliseconds

const readFile = () => {
  const filename = process.argv[2];
  if (filename === undefined) {
    console.log("Usage: node playmidi.js <midi-file>");
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(filename, "utf8"));
  data.notes.sort((a, b) => a.time - b.time);
  return data;
};

const realTime = (bpm) => (time) => time * (60 / bpm) * 1000;

const now = function () {
  return (function (t) {
    return (t[0] + t[1] / 1e9) * 1000;
  })(process.hrtime());
};

const logToFile = (message) => {
  fs.appendFile('debug.log', message + '\n', (err) => {
    if (err) throw err;
  });
}

// <GLOBAL STATE>
const output = new easymidi.Output("arstneio", true);
const overallStartTime = now();
let latestEndingNote = now();
const timeouts = new Map();
const data = readFile();
// </GLOBAL STATE>

const scheduleNote = function (note, time0, noteId) {
  const startTime = realTime(data.bpm)(note.time) + time0 + BUFFER_SIZE;
  const endTime =
    realTime(data.bpm)(note.time + note.duration) + time0 + BUFFER_SIZE;
  logToFile(`scheduling note ${noteId} at ${startTime - overallStartTime} to ${endTime - overallStartTime} (${endTime - startTime} ms)`);
  latestEndingNote = Math.max(latestEndingNote, endTime);
  const { pitch, channel, velocity } = note;
  const _now = now();
  timeouts.set(
    [noteId, "noteon"].toString(),
    setTimeout(() => {
      output.send("noteon", {
        channel,
        velocity,
        note: pitch,
      });
      timeouts.delete([noteId, "noteon"].toString());
    }, startTime - _now)
  );
  timeouts.set(
    [noteId, "noteoff"].toString(),
    setTimeout(function () {
      output.send("noteoff", {
        channel,
        velocity,
        note: pitch,
      });
      timeouts.delete([noteId, "noteoff"].toString());
    }, endTime - _now)
  );
};

const killAllNotes = function () {
  timeouts.forEach((timeout, key) => {
    const [noteId, eventType] = key.split(",");
    if (eventType === "noteoff") {
      const note = data.notes[noteId];
      output.send("noteoff", {
        note: note.pitch,
        channel: note.channel,
        velocity: note.velocity,
      });
    } else if (eventType === "noteon") {
      clearTimeout(timeouts.get(key));
    }
    timeouts.delete(key);
  });
};

const finish = function () {
  killAllNotes();
  process.exit(0);
};

const scheduleNotes = (notePos) => {
  if (notePos === void 0) {
    // notePos = 0;
    throw new Error("notePos is undefined, for some reason");
  }
  const timeWindowEnd = now() + BUFFER_SIZE - overallStartTime;
  while (
    notePos < data.notes.length &&
    realTime(data.bpm)(data.notes[notePos].time) < timeWindowEnd
  ) {
    const note = data.notes[notePos];
    scheduleNote(note, overallStartTime, notePos);
    notePos += 1;
  }
  if (notePos < data.notes.length) {
    setTimeout(function () {
      return scheduleNotes(notePos);
    }, BUFFER_INCREMENT);
  } else {
    setTimeout(finish, latestEndingNote - now() + 100);
  }
};

const listenForQuit = () => {
	if (process.stdin.setRawMode) {
		process.stdin.setRawMode(true);
	}
  process.stdin.resume();
  process.stdin.on("data", function (input) {
		console.log('player got input:', input)
    if (input.toString().indexOf("q") > -1) {
      finish();
    }
  });
};

const main = function () {
  console.log('Playing. Press "q" to quit.');
  scheduleNotes(0);
  listenForQuit();
};

main();
