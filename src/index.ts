import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as auth from './auth.js';
import * as extension from './extension.js';

const cli = yargs(hideBin(process.argv))
  .scriptName('elfsquad')
  .strictCommands()
  .demandCommand(1, 'You need at least one command')

auth.register(cli);
extension.register(cli);

cli.parse();

