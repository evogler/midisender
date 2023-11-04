"use strict";
exports.__esModule = true;
var child_process_1 = require("child_process");
var fs_1 = require("fs");
var notes = [];
var time = 0;
var shuffle = function (array) {
    return array.map(function (n) { return [Math.random(), n]; }).sort(function (a, b) { return a[0] - b[0]; }).map(function (n) { return n[1]; });
};
var range = function (start, end) {
    var res = [];
    for (var i = start; i <= end; i++) {
        res.push(i);
    }
    return res;
};
var row = shuffle(range(48, 59));
var trans = 0;
for (var i = 0; i < 4000; i++) {
    if (Math.random() < .2) {
        trans = ~~(Math.random() * 12);
    }
    var pitches = [];
    var pLen = ~~(Math.random() * 10 * 2);
    var pStart = ~~(Math.random() * 10 * 2);
    for (var i_1 = pLen; i_1 < (pLen + pStart); i_1++) {
        pitches.push(row[i_1 % row.length] + trans);
    }
    var duration = Math.random() * .2 + .2;
    for (var _i = 0, pitches_1 = pitches; _i < pitches_1.length; _i++) {
        var pitch = pitches_1[_i];
        var note = {
            pitch: pitch,
            velocity: 70,
            channel: 0,
            time: time,
            duration: duration
        };
        notes.push(note);
        time += duration;
    }
    time += .5 + Math.random();
}
var MusicData = { bpm: 120, notes: notes };
(0, fs_1.writeFileSync)("./notes.json", JSON.stringify(MusicData));
var child = (0, child_process_1.fork)("playmidi.js", ["notes.json"]);
