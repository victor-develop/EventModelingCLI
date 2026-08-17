#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { Workspace } from '../workspace/workspace';
import { routeCommand } from './router';
import { startServer } from './serve';
import { CLIResult, errResult } from '../domain/types';
import type { EventFieldEvolutionWarningCode } from '../schema/event-evolution-policy';

export interface EventGuardTerminal {
  stdinIsTTY: boolean;
  stderrIsTTY: boolean;
  writeStderr(text: string): void;
  readLine(prompt: string): Promise<string | null>;
}

export async function executeRoutedCommand(
  ws: Workspace,
  rawArgs: string[],
  terminal: EventGuardTerminal,
): Promise<CLIResult> {
  const preflight = routeCommand(ws, rawArgs);
  if (preflight.error?.code !== 'EVENT_SCHEMA_EVOLUTION_CONFIRMATION_REQUIRED') return preflight;
  if (!terminal.stdinIsTTY || !terminal.stderrIsTTY) return preflight;

  terminal.writeStderr(formatEventEvolutionPrompt(preflight));
  const answer = await terminal.readLine('Continue? [y/N] ');
  const normalized = answer?.trim().toLowerCase();
  if (normalized !== 'y' && normalized !== 'yes') {
    return errResult(
      preflight.command,
      'EVENT_SCHEMA_EVOLUTION_CANCELLED',
      'Event schema evolution cancelled; no changes were written.',
      {
        projectId: preflight.projectId,
        draftId: preflight.draftId,
        details: preflight.error.details,
      },
    );
  }

  const warningCodes = readWarningCodes(preflight);
  return routeCommand(ws, rawArgs, {
    mutationAcknowledgement: {
      source: 'interactive-confirmation',
      compatibilityWarningCodes: warningCodes,
    },
  });
}

function formatEventEvolutionPrompt(result: CLIResult): string {
  const details = result.error?.details ?? {};
  const eventId = safeDisplay(details.eventId);
  const fieldId = safeDisplay(details.fieldId);
  const before = fieldSummary(details.before);
  const after = details.after === null ? 'removed' : fieldSummary(details.after);
  const warningMessages = Array.isArray(details.warnings)
    ? details.warnings
      .map(item => item && typeof item === 'object' ? safeDisplay((item as Record<string, unknown>).message) : '')
      .filter(Boolean)
    : [];
  const recommendation = safeDisplay(details.recommendation);
  const reviewCodes = readWarningCodes(result).join(', ');
  return [
    '',
    ...warningMessages.map(message => `Warning: ${message}`),
    '',
    `  Event:  ${eventId}`,
    `  Field:  ${fieldId}`,
    `  Before: ${before}`,
    `  After:  ${after}`,
    '',
    recommendation,
    '',
    `This change will remain visible as ${reviewCodes} in Draft Review.`,
  ].join('\n') + '\n';
}

function fieldSummary(value: unknown): string {
  if (!value || typeof value !== 'object') return 'unknown';
  const field = value as Record<string, unknown>;
  return `name=${safeDisplay(field.name)}, type=${safeDisplay(field.type)}, required=${String(field.required === true)}`;
}

function safeDisplay(value: unknown): string {
  if (typeof value !== 'string') return '';
  return JSON.stringify(value).slice(1, -1);
}

function readWarningCodes(result: CLIResult): EventFieldEvolutionWarningCode[] {
  const value = result.error?.details?.warningCodes;
  if (!Array.isArray(value)) return [];
  return value.filter((code): code is EventFieldEvolutionWarningCode => (
    code === 'EVENT_FIELD_TYPE_CHANGED'
    || code === 'EVENT_FIELD_REMOVED'
    || code === 'EVENT_FIELD_REQUIREDNESS_CHANGED'
    || code === 'EVENT_FIELD_RENAMED'
  ));
}

function print(result: CLIResult) {
  if (result.ok) {
    if (
      typeof result.data?.output === 'string' &&
      (result.data.format === 'table' || result.data.format === 'ascii')
    ) {
      console.log(result.data.output);
      return;
    }

    if (result.data && typeof result.data === 'object') {
      console.log(JSON.stringify(result.data, null, 2));
    }
    for (const w of result.warnings) {
      console.warn(`⚠ ${w}`);
    }
  } else {
    if (result.error?.code === 'EVENT_SCHEMA_EVOLUTION_CONFIRMATION_REQUIRED') {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = 1;
      return;
    }
    console.error(`Error: ${result.error?.message ?? 'Unknown error'}`);
    if (result.error?.code) {
      console.error(`  Code: ${result.error.code}`);
    }
    process.exitCode = 1;
  }
}

async function main() {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.length === 0) {
    console.log('Usage: em <command> [args...] [flags]');
    console.log('');
    console.log('Commands:');
    console.log('  project init <name> [--path <repo-relative-dir>]  Create a new project');
    console.log('  project open [name] [--path <repo-relative-dir>]  Open an existing project');
    console.log('  project migrate --path <repo-relative-dir>         Copy active workspace to an embedded path');
    console.log('  ctx                       Show current context');
    console.log('  draft start --n <name>    Start a new draft');
    console.log('  cmd new <id>              Create a command node');
    console.log('  cmd schema init/show <id> Manage a command input schema');
    console.log('  cmd field add/edit/rm     Manage command input fields');
    console.log('  evt new <id>              Create an event node');
    console.log('  evt schema init/show <id> Manage an event payload schema');
    console.log('  evt field add/edit/rm     Manage event payload fields');
    console.log('  view new <id>             Create a view model node');
    console.log('  proc new <id>             Create a processor node [--owner-role <roleId>]');
    console.log('  ui add <kind>             Add UI node [--owner-role <roleId>]');
    console.log('  role add <id>             Create a role node [--name <label>]');
    console.log('  link cmd->evt <a> <b>     Link command to event');
    console.log('  link evt->view <a> <b>    Link event to view model');
    console.log('  walk --from <id>          Walk the graph');
    console.log('  layout --focus <id>       Generate layout (--format json|table|ascii)');
    console.log('  graph                     Show graph (mermaid)');
    console.log('  serve [--port <n>]        Start API server for em-viewer');
    console.log('  roots                      List flow root nodes');
    console.log('  validate                  Validate the model');
    console.log('');
    return;
  }

  // 'serve' is long-running — handle before synchronous routeCommand
  if (rawArgs[0] === 'serve') {
    const portIdx = rawArgs.indexOf('--port');
    const port = portIdx !== -1 && rawArgs[portIdx + 1]
      ? parseInt(rawArgs[portIdx + 1]!)
      : undefined;

    const ws = new Workspace(process.cwd());
    const resolutionError = ws.getResolutionError();
    if (resolutionError) {
      console.error(`Error: ${resolutionError.message}`);
      console.error(`  Code: ${resolutionError.code}`);
      process.exit(1);
    }
    startServer(ws, { port });
    // startServer installs the long-lived HTTP server handle.
    return;
  }

  const ws = new Workspace(process.cwd());
  const terminal: EventGuardTerminal = {
    stdinIsTTY: process.stdin.isTTY === true,
    stderrIsTTY: process.stderr.isTTY === true,
    writeStderr: text => process.stderr.write(text),
    readLine: async prompt => {
      const readline = createInterface({ input: process.stdin, output: process.stderr });
      try {
        return await readline.question(prompt);
      } catch {
        return null;
      } finally {
        readline.close();
      }
    },
  };
  const result = await executeRoutedCommand(ws, rawArgs, terminal);
  print(result);
}

if (require.main === module) {
  void main().catch(error => {
    console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exitCode = 1;
  });
}
