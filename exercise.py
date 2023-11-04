#!/usr/bin/env python3
from itertools import cycle
import math
from playmidi import *
import random


def scale(key):
    return sorted([(i + key) % 12 for i in [0, 2, 4, 7, 9]])


def randOctave():
    return random.choice([3, 4, 5, 6, 7]) * 12

chordTypes = {
    'maj': [0, 4, 7],
    'min': [0, 3, 7],
    'dim': [0, 3, 6],
    'aug': [0, 4, 8],
    'sus': [0, 5, 7],
    '7': [0, 4, 7, 10],
    'maj7': [0, 4, 7, 11],
    # 'maj7': [0, 4, 9, 14],
    'min7': [0, 2, 3, 7],
    'dim7': [0, 3, 6, 9],
    'hdim7': [0, 3, 6, 10],
    'maj6': [0, 4, 7, 9],
    'min6': [0, 3, 7, 9]
}

def transposed(notes, amount):
    return [i + amount for i in notes]

def arpeggios(chords):
    res = []
    for i, chord in enumerate(chords):
        baseChord = chordTypes[chord[1]]
        newChord = transposed(baseChord, chord[0])
        if i % 2 == 1:
            newChord.reverse()
        res.extend(newChord)
    return res

def surround(notes):
    res = []
    for i, note in enumerate(notes):
        if i % 9 in [1, 4, 6]:
            lead_note = note - 4
            if res and res[-1] == lead_note:
                res[-1] -= 1
            res.extend([lead_note, note])
        else:
            res.append(note)
    return res

def repeat_notes_transposed(notes, degrees):
    return [note + degree  for degree in degrees for note in notes]

def progression_transpositions(progression, degrees):
    return [[chord[0] + degree, chord[1]] for degree in degrees for chord in progression]

def transpose_pattern(notes, pattern):
    return [note + degree for note, degree in zip(notes, cycle(pattern))]

def fit(arr, overall_length):
    return [i * overall_length / sum(arr) for i in arr]

def fitEighths(arr):
    return fit(arr, len(arr) / 2)

def nth(n, arr):
    return arr[n % len(arr)]

# fit n from one window to another
def window(from_min, from_max, to_min, to_max):
    def res(n):
        return (to_min + (n - from_min) * (to_max - to_min) / (from_max - from_min))
    return res

make_vel = window(0, 10, 0, 127)

def composition():
    data = {"bpm": 250, "notes": []}
    timePos = 0
    notes = [0, 4, 7, 12, 7, 4] * 100
    notes = transpose_pattern(notes, [0, 0, 12, 12, 0 ,0, -12])
    notes = surround(notes)
    for i, p in enumerate(notes):
        S = 2; L = 3
        # dur = nth(i, [*fitEighths([*[S] * 3, L])])
        dur = .5
        vel = 6
        leg = 1
        for trans in [60, 72]:
            data["notes"].append({
                "pitch": p + trans,
                "velocity": int(make_vel(vel)),
                "channel": 1,
                "time": timePos,
                "duration": dur * leg,
            })
        timePos += dur
    return data


if __name__ == '__main__':
    writeToFileAndPlay(composition())
