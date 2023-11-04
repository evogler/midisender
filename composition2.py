#!/usr/bin/env python3
from itertools import cycle
import math
from playmidi import *
import random
from copy import copy


def fit(arr, overall_length):
    return [i * overall_length / sum(arr) for i in arr]

def fitEighths(arr):
    return fit(arr, len(arr) / 2)

def nth(n, arr):
    return arr[n % len(arr)]

def window(from_min, from_max, to_min, to_max):
    def res(n):
        return (to_min + (n - from_min) * (to_max - to_min) / (from_max - from_min))
    return res

make_vel = window(0, 10, 0, 127)

def composition():
    data = {"bpm": 300, "notes": []}
    timePos = 0
    phrase = [{
        "d": random.choice([.5, .6, .7]),
        "p": n,
        "v": 6,
        } for n in random.sample(range(30,60), 4)]
    notes = []
    for i in range(40):
        odds = [1, .7, 1, .3][i % 4]
        for i in range(len(phrase)):
            phrase[i]["p"] += random.choice([-1, 0, 0, 1])
            phrase[i]["odds"] = odds
            notes.append(copy(phrase[i]))
    for i, n in enumerate(notes):
        dur = n['d']
        vel = n['v']
        leg = 1
        pitch = n['p']
        odds = n['odds']
        for trans in [23]:
            if random.random() < odds:
                data["notes"].append({
                    "pitch": pitch + trans,
                    "velocity": int(make_vel(vel)),
                    "channel": 1,
                    "time": timePos,
                    "duration": dur * leg,
                })
        timePos += dur
    return data

writeToFileAndPlay(composition())
