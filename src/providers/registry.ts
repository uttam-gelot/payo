/**
 * Provider registry. Maps an AiTool id to its Strategy implementation.
 * Adding a provider is one `registerProvider` call — never a switch.
 */
import type { AiTool } from '../types/index';
import type { AiProvider } from '../generator/types';

const registry = new Map<AiTool, AiProvider>();

export function registerProvider(provider: AiProvider): void {
  registry.set(provider.id, provider);
}

export function getProvider(id: AiTool | undefined): AiProvider | undefined {
  return id ? registry.get(id) : undefined;
}

export function listProviders(): AiProvider[] {
  return [...registry.values()];
}
