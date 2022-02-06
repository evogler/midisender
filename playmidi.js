var fs = require("fs");
var easymidi = require("easymidi");
var output = new easymidi.Output("arstneio", true);
var filename = process.argv[2];
if (filename === undefined) {
    console.log("Usage: node playmidi.js <midi-file>");
    process.exit(1);
}
var data = JSON.parse(fs.readFileSync(filename, "utf8"));
var realTime = function (bpm) { return function (time) { return time * (60 / bpm) * 1000; }; };
data.notes.sort(function (a, b) { return a.time - b.time; });
var playing = true;
var bufferSize = 1000; // milliseconds
var bufferIncrement = 100; // milliseconds
var now = function () { return (function (t) { return (t[0] + t[1] / 1e9) * 1000; })(process.hrtime()); };
var overallStartTime = now();
var latestEndingNote = now();
var timeouts = new Map();
var scheduleNote = function (note, time0, noteId) {
    var startTime = realTime(data.bpm)(note.time) + time0 + bufferSize;
    var endTime = realTime(data.bpm)(note.time + note.duration) + time0 + bufferSize;
    var pitch = note.pitch, channel = note.channel, velocity = note.velocity;
    timeouts.set([noteId, "noteon"], setTimeout(function () {
        timeouts["delete"]([noteId, "noteon"]);
        if (!playing)
            return;
        output.send("noteon", { note: pitch, channel: channel, velocity: velocity });
        latestEndingNote = Math.max(latestEndingNote, endTime);
    }, startTime - now()));
    timeouts.set([noteId, "noteoff"], setTimeout(function () {
        timeouts["delete"]([noteId, "noteoff"]);
        if (!playing)
            return;
        output.send("noteoff", { note: pitch, channel: channel, velocity: velocity });
    }, endTime - now()));
};
var cancelTimeouts = function () {
    timeouts.forEach(function (timeout) { return clearTimeout(timeout); });
    timeouts.clear();
};
var killAllNotes = function () {
    for (var reps = 0; reps < 1; reps++) {
        var _loop_1 = function (i) {
            setTimeout(function () {
                output.send("noteoff", { note: i, channel: 1, velocity: 0 });
            }, 0);
        };
        for (var i = 0; i < 128; i++) {
            _loop_1(i);
        }
    }
};
var finish = function () {
    killAllNotes();
    console.log("finish()");
    setTimeout(function () { return process.exit(0); }, 150);
};
var scheduleNotes = function (notePos, timeWindowStart) {
    if (notePos === void 0) { notePos = 0; }
    if (timeWindowStart === void 0) { timeWindowStart = 0; }
    var timeWindowEnd = timeWindowStart + bufferSize;
    while (notePos < data.notes.length &&
        realTime(data.bpm)(data.notes[notePos].time) < timeWindowEnd) {
        var note = data.notes[notePos];
        scheduleNote(note, overallStartTime, notePos);
        notePos += 1;
    }
    if (notePos < data.notes.length) {
        setTimeout(function () { return scheduleNotes(notePos, timeWindowStart + bufferIncrement); }, bufferIncrement);
    }
    else {
        setTimeout(finish, latestEndingNote - now());
    }
};
var listenForQuit = function () {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", function (input) {
        if (input.toString() === "q") {
            playing = false;
            setTimeout(killAllNotes, 2000);
            setTimeout(function () { return process.exit(0); }, 2500);
        }
    });
};
var main = function () {
    killAllNotes();
    scheduleNotes(0);
    listenForQuit();
};
main();
