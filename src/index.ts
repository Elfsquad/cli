import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as auth from './auth.js';

const cli = yargs(hideBin(process.argv))
  .scriptName('elfsquad')
  .strictCommands();

auth.register(cli);

cli.parse();

