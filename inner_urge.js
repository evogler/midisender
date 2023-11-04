"use strict";
var _a, _b;
exports.__esModule = true;
var child_process_1 = require("child_process");
var fs_1 = require("fs");
var ChordType;
(function (ChordType) {
    ChordType[ChordType["DOR"] = 0] = "DOR";
    ChordType[ChordType["LYD"] = 1] = "LYD";
    ChordType[ChordType["MIX"] = 2] = "MIX";
    ChordType[ChordType["AEOL"] = 3] = "AEOL";
})(ChordType || (ChordType = {}));
var LYD = ChordType.LYD, MIX = ChordType.MIX, DOR = ChordType.DOR, AEOL = ChordType.AEOL;
var ChordNotes = (_a = {},
    _a[DOR] = [0, 3, 7, 9],
    _a[LYD] = [0, 4, 6, 11],
    _a[MIX] = [0, 4, 9, 10],
    _a[AEOL] = [0, 3, 7, 8],
    _a);
var ChordTypeRoots = (_b = {},
    _b[DOR] = 2,
    _b[LYD] = 5,
    _b[MIX] = 7,
    _b[AEOL] = 9,
    _b);
var innerUrge = [
    [4, LYD],
    [1, LYD],
    [2, LYD],
    [11, LYD],
    [0, LYD],
    [9, LYD],
    [10, LYD],
    [7, LYD],
];
var relativeChord = function (chord, newType) {
    var root = chord[0], type = chord[1];
    var newRoot = (ChordTypeRoots[newType] - ChordTypeRoots[type] + root + 12) % 12;
    return [newRoot, newType];
};
var voiceChord = function (chord) {
    var root = chord[0], type = chord[1];
    var chordNotes = ChordNotes[type].map(function (n) { return (n + root) % 12; });
    chordNotes[0] -= 24;
    return chordNotes;
};
var choice = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
// const pattern: (ChordType | "")[] = [DOR, MIX, DOR, DOR, LYD, DOR, LYD, DOR];
var pattern = ['', '', '', '', '', '', '', ''];
var reharmChords = innerUrge.map(function (chord, i) {
    var match = pattern[i] !== "";
    var cType = match ? pattern[i] : choice([LYD, MIX, DOR, AEOL]);
    return relativeChord(chord, cType);
});
console.log(reharmChords);
var notes = [];
var time = 0;
for (var choruses = 0; choruses < 40; choruses++) {
    for (var i = 0; i < reharmChords.length; i++) {
        var chord = reharmChords[i];
        var chordNotes = voiceChord(chord);
        var duration = 2;
        var transpose = 60;
        for (var j = 0; j < chordNotes.length; j++) {
            var note = {
                pitch: chordNotes[j] + transpose,
                velocity: 70,
                channel: 0,
                time: time,
                duration: duration
            };
            notes.push(note);
        }
        time += duration;
    }
}
var MusicData = { bpm: 120, notes: notes };
(0, fs_1.writeFileSync)("./notes.json", JSON.stringify(MusicData));
var child = (0, child_process_1.fork)("playmidi.js", ["notes.json"]);
