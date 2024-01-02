const fs = require('fs');

// Read the input INI file
const inputFile = process.argv[2];
const iniData = fs.readFileSync(inputFile, 'utf-8');

// Remove lines that are solely comments with optional leading whitespace
const cleanedIni = iniData
  .split('\n')
  .filter(line => !line.match(/^[ \t]*;/))
  // Remove any comments that come after values
  .map(line => line.replace(/;.*/, ''))
  // Delete blank lines
  .filter(line => line.trim() !== '')
  // Remove whitespace around the equals signs
  .map(line => line.replace(/[ \t]*=[ \t]*/, '='))
  .join('\n');

// Write the cleaned INI data to a temporary file
const tempFile = inputFile + '.tmp.ini';
fs.writeFileSync(tempFile, cleanedIni, 'utf-8');

// Rename the temporary file to the original file
fs.renameSync(tempFile, inputFile);

