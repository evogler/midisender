"use strict";
exports.__esModule = true;
var fs_1 = require("fs");
var easymidi_1 = require("easymidi");
var output = new easymidi_1["default"].Output("arstneio", true);
var filename = process.argv[2];
if (filename === undefined) {
    console.log("Usage: node playmidi.js <midi-file>");
    process.exit(1);
}
var data = JSON.parse(fs_1["default"].readFileSync(filename, "utf8"));
var realTime = function (bpm) { return function (time) { return time * (60 / bpm) * 1000; }; };
data.notes.sort(function (a, b) { return a.time - b.time; });
var bufferSize = 1000; // milliseconds
var bufferIncrement = 100; // milliseconds
var now = function () { return (function (t) { return (t[0] + t[1] / 1e9) * 1000; })(process.hrtime()); };
var overallStartTime = now();
var latestEndingNote = now();
var timeouts = new Map();
var scheduleNote = function (note, time0, noteId) {
    var startTime = realTime(data.bpm)(note.time) + time0 + bufferSize;
    var endTime = realTime(data.bpm)(note.time + note.duration) + time0 + bufferSize;
    latestEndingNote = Math.max(latestEndingNote, endTime);
    var pitch = note.pitch, channel = note.channel, velocity = note.velocity;
    timeouts.set([noteId, "noteon"].toString(), setTimeout(function () {
        output.send("noteon", { note: pitch, channel: channel, velocity: velocity });
        timeouts["delete"]([noteId, "noteon"].toString());
    }, startTime - now()));
    timeouts.set([noteId, "noteoff"].toString(), setTimeout(function () {
        output.send("noteoff", { note: pitch, channel: channel, velocity: velocity });
        timeouts["delete"]([noteId, "noteoff"].toString());
    }, endTime - now()));
};
var killAllNotes = function () {
    timeouts.forEach(function (timeout, key) {
        var _a = key.split(","), noteId = _a[0], eventType = _a[1];
        if (eventType === "noteoff") {
            var note = data.notes[noteId];
            output.send("noteoff", {
                note: note.pitch,
                channel: note.channel,
                velocity: note.velocity
            });
        }
        else if (eventType === "noteon") {
            clearTimeout(timeouts.get(key));
        }
        timeouts["delete"](key);
    });
};
var finish = function () {
    killAllNotes();
    process.exit(0);
};
var scheduleNotes = function (notePos) {
    if (notePos === void 0) { notePos = 0; }
    var timeWindowEnd = now() + bufferSize - overallStartTime;
    while (notePos < data.notes.length &&
        realTime(data.bpm)(data.notes[notePos].time) < timeWindowEnd) {
        var note = data.notes[notePos];
        scheduleNote(note, overallStartTime, notePos);
        notePos += 1;
    }
    if (notePos < data.notes.length) {
        setTimeout(function () { return scheduleNotes(notePos); }, bufferIncrement);
    }
    else {
        setTimeout(finish, latestEndingNote - now() + 100);
    }
};
var listenForQuit = function () {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", function (input) {
        if (input.toString() === "q") {
            finish();
        }
    });
};
var main = function () {
    console.log('Playing. Press "q" to quit.');
    scheduleNotes(0);
    listenForQuit();
};
main();
