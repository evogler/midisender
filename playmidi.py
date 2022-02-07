import subprocess
import json

def writeToFileAndPlay(data, filename="notes.json"):
    with open(filename, "w") as f:
        json.dump(data, f, indent=2)
    subprocess.run(['node', 'playmidi.js', filename])
