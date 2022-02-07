from playmidi import *
import random


def scale(key):
    return sorted([(i + key) % 12 for i in [0, 2, 4, 7, 9]])


def randOctave():
    return random.choice([3, 4, 5, 6, 7]) * 12


def composition():
    data = {"bpm": 100, "notes": []}
    chordTime = 0
    for i in range(17):
        newNotes = []
        for j in range(16):
            p = random.choice(scale(int(i / 2))) + randOctave()
            if p not in newNotes:
                newNotes.append(p)
        newNotes.sort()
        for j, p in enumerate(newNotes):
            data["notes"].append({
                "pitch": p,
                "velocity": 50 + i * 3,
                "channel": 1,
                "time": chordTime + j / 24,
                "duration": 0.15,
            })
        chordTime += random.choice([0.5, 0.75, 1.5])
    return data


if __name__ == '__main__':
    writeToFileAndPlay(composition())
