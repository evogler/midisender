# Midisender

A small program that sends midi events from a JSON file to a virtual midi instrument, in time.

## Installation
1. `git clone https://github.com/evogler/midisender`
2. `cd midisender`
3. `npm install` or `yarn install`

## Usage

### Stand-alone player

1. Open Logic Pro (or GarageBand, or any program that can receive midi).
2. Create a software instrument and make sure it's selected.
3. `npm run play notes.json` or `yarn play notes.json`. You should hear some notes play.

