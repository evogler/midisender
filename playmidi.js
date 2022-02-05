var fs = require("fs");
var easymidi = require("easymidi");
var output = new easymidi.Output("arstneio", true);
var data = JSON.parse(fs.readFileSync("./notes.txt", "utf8"));
var realTime = function (bpm) { return function (time) { return time * (60 / bpm) * 1000; }; };
data.notes.sort(function (a, b) { return a.time - b.time; });
var soundingNotes = {};
var playing = true;
var bufferSize = 1000; // milliseconds
var bufferIncrement = 100; // milliseconds
var now = function () { return (function (t) { return (t[0] + t[1] / 1e9) * 1000; })(process.hrtime()); };
var overallStartTime = now();
var scheduleNote = function (note, time0) {
    var startTime = realTime(data.bpm)(note.time) + time0 + bufferSize;
    var endTime = realTime(data.bpm)(note.time + note.duration) + time0 + bufferSize;
    var pitch = note.pitch, channel = note.channel, velocity = note.velocity;
    setTimeout(function () {
        if (!playing)
            return;
        output.send("noteon", { note: pitch, channel: channel, velocity: velocity });
        soundingNotes[note.pitch] = (soundingNotes[note.pitch] || 0) + 1;
    }, startTime - now());
    setTimeout(function () {
        if (!playing)
            return;
        soundingNotes[note.pitch] = soundingNotes[note.pitch] - 1;
        if (soundingNotes[note.pitch] <= 0) {
            delete soundingNotes[note.pitch];
            output.send("noteoff", { note: pitch, channel: channel, velocity: velocity });
        }
    }, endTime - now());
};
var killAllNotes = function () {
    // for (const note of Object.keys(soundingNotes)) {
    for (var reps = 0; reps < 10; reps++) {
        for (var i = 0; i < 128; i++) {
            output.send("noteoff", { note: i, channel: 1, velocity: 0 });
        }
    }
};
var scheduleNotes = function (notePos, timeWindowStart) {
    if (notePos === void 0) { notePos = 0; }
    if (timeWindowStart === void 0) { timeWindowStart = 0; }
    var timeWindowEnd = timeWindowStart + bufferSize;
    while (notePos < data.notes.length &&
        realTime(data.bpm)(data.notes[notePos].time) < timeWindowEnd) {
        var note = data.notes[notePos];
        scheduleNote(note, overallStartTime);
        notePos += 1;
    }
    if (notePos < data.notes.length) {
        setTimeout(function () { return scheduleNotes(notePos, timeWindowStart + bufferIncrement); }, bufferIncrement);
    }
    else {
        setTimeout(function () {
            console.log("done");
            killAllNotes();
            setTimeout(function () { return process.exit(0); }, 1000);
        }, 1000);
    }
};
var listenForQuit = function () {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", function (input) {
        if (input.toString() === "q") {
            playing = false;
            killAllNotes();
            setTimeout(function () { return process.exit(0); }, 1000);
        }
    });
};
var main = function () {
    killAllNotes();
    scheduleNotes(0);
    listenForQuit();
};
main();
