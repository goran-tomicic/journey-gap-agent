# journey-gap-agent

Reads a cross-team journey (a list of touchpoints) and flags gaps, ownership
conflicts, and channel mismatches, with reasoning shown for each flag.

## Setup
1. `cp .env.example .env` and fill in your Anthropic API key
2. `npm install`

## Usage
```
npm start -- --input data/journey.csv --output report.md
```
Omit `--output` to print the report to stdout instead.
