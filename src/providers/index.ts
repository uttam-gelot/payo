/**
 * Registers every built-in provider and re-exports the registry API.
 * Import this module once (the generator does) to populate the registry.
 */
import { registerProvider, getProvider, listProviders } from './registry';
import { cursorProvider } from './cursor';
import { claudeProvider } from './claude';
import { copilotProvider } from './copilot';
import { windsurfProvider } from './windsurf';
import { codexProvider } from './codex';
import { antigravityProvider } from './antigravity';
import { genericProvider } from './generic';

// Registration order drives the AI-tool picker order (see aiToolOptions).
registerProvider(claudeProvider);
registerProvider(codexProvider);
registerProvider(antigravityProvider);
registerProvider(cursorProvider);
registerProvider(copilotProvider);
registerProvider(windsurfProvider);
registerProvider(genericProvider);

export { getProvider, listProviders, registerProvider };
