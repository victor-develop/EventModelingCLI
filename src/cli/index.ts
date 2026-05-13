#!/usr/bin/env node
import { Workspace } from '../workspace/workspace';
import { routeCommand } from './router';
import { startServer } from './serve';

function print(result: import('../domain/types').CLIResult) {
  if (result.ok) {
    if (result.data && typeof result.data === 'object') {
      console.log(JSON.stringify(result.data, null, 2));
    }
    for (const w of result.warnings) {
      console.warn(`⚠ ${w}`);
    }
  } else {
    console.error(`Error: ${result.error?.message ?? 'Unknown error'}`);
    if (result.error?.code) {
      console.error(`  Code: ${result.error.code}`);
    }
    process.exit(1);
  }
}

function main() {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.length === 0) {
    console.log('Usage: em <command> [args...] [flags]');
    console.log('');
    console.log('Commands:');
    console.log('  project init <name>       Create a new project');
    console.log('  project open <name>       Open an existing project');
    console.log('  ctx                       Show current context');
    console.log('  draft start --n <name>    Start a new draft');
    console.log('  cmd new <id>              Create a command node');
    console.log('  evt new <id>              Create an event node');
    console.log('  view new <id>             Create a view model node');
    console.log('  link cmd->evt <a> <b>     Link command to event');
    console.log('  link evt->view <a> <b>    Link event to view model');
    console.log('  walk --from <id>          Walk the graph');
    console.log('  layout --focus <id>       Generate layout');
    console.log('  graph                     Show graph (mermaid)');
    console.log('  serve [--port <n>]        Start API server for em-viewer');
    console.log('  roots                      List flow root nodes');
    console.log('  validate                  Validate the model');
    console.log('');
    process.exit(0);
  }

  // 'serve' is long-running — handle before synchronous routeCommand
  if (rawArgs[0] === 'serve') {
    const portIdx = rawArgs.indexOf('--port');
    const port = portIdx !== -1 && rawArgs[portIdx + 1]
      ? parseInt(rawArgs[portIdx + 1]!)
      : undefined;

    const ws = new Workspace(process.cwd());
    startServer(ws, { port });
    // startServer returns Promise<void> — intentionally not awaited.
    // app.listen() keeps the Node process alive via the open TCP socket.
    return;
  }

  const ws = new Workspace(process.cwd());
  const result = routeCommand(ws, rawArgs);
  print(result);
}

main();
