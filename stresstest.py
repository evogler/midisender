import subprocess
import json
import random


def writeToFileAndPlay(data, filename="notes.json"):
    with open(filename, "w") as f:
        json.dump(data, f, indent=2)
    subprocess.run(['node', 'playmidi.js', filename])
    print('Music over.')


def scale(key):
    return sorted([(i + key) % 12 for i in [0, 2, 4, 7, 9]])


def randOctave():
    return random.choice([3, 4, 5, 6, 7]) * 12


def composition():
    data = {"bpm": 60, "notes": []}
    chordTime = 0
    for e, i in enumerate([
        *range(60),
        *range(60),
        *range(60),
        ]):
        data['notes'].append({
            "pitch": 30 + i,
            "velocity": 60,
            "channel": 0,
            "time": e / 40,
            "duration": 4})
    return data


if __name__ == '__main__':
    writeToFileAndPlay(composition())
