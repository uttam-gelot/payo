/** Detect a C# / .NET stack from *.csproj project files. */
import type { DetectionResult, DetectionSource } from './types';
import { dotnetDeps } from './manifest';
import {
  firstMatch,
  DOTNET_CLI,
  DOTNET_CLI_FRAMEWORK,
  DOTNET_DATABASE,
  DOTNET_ORM,
  DOTNET_VALIDATION,
  DOTNET_LOGGER,
  DOTNET_LINTER,
  DOTNET_TEST_RUNNER,
  DOTNET_AUTH,
} from './signals';

/** EF Core ships as many `*.entityframeworkcore.*` provider packages; any one implies EF Core. */
const EF_CORE_PREFIXES = [
  'microsoft.entityframeworkcore',
  'npgsql.entityframeworkcore',
  'pomelo.entityframeworkcore',
  'mongodb.entityframeworkcore',
];

export function detectDotnet(cwd: string): DetectionResult | null {
  const manifest = dotnetDeps(cwd);
  if (manifest === undefined) return null;

  const { deps, sdks } = manifest;
  const answers: Record<string, unknown> = {};
  const sources: Record<string, DetectionSource> = {};
  const set = (id: string, value: string | undefined): void => {
    if (value !== undefined) {
      answers[id] = value;
      sources[id] = 'csproj';
    }
  };

  set('language', 'csharp');

  // ASP.NET Core is signalled by the Web/Blazor project SDK or an AspNetCore ref.
  const isWeb =
    sdks.some((s) => /\bweb\b|blazor/i.test(s)) ||
    [...deps].some((d) => d.startsWith('microsoft.aspnetcore'));

  let projectType: string | undefined;
  if (isWeb) {
    set('framework', 'aspnet-core');
    projectType = 'backend';
  } else if ([...deps].some((d) => DOTNET_CLI.has(d))) {
    projectType = 'cli';
    set('framework', firstMatch(deps, DOTNET_CLI_FRAMEWORK));
  }
  set('projectType', projectType);

  set('database', firstMatch(deps, DOTNET_DATABASE));
  const hasEfCore = [...deps].some((d) => EF_CORE_PREFIXES.some((p) => d.startsWith(p)));
  set('orm', hasEfCore ? 'ef-core' : firstMatch(deps, DOTNET_ORM));
  set('validation', firstMatch(deps, DOTNET_VALIDATION));
  set('logger', firstMatch(deps, DOTNET_LOGGER));
  // dotnet format ships with the SDK — it's the universal built-in formatter.
  set('formatter', deps.has('csharpier') ? 'csharpier' : 'dotnet-format');
  set('linter', firstMatch(deps, DOTNET_LINTER));
  set('testRunner', firstMatch(deps, DOTNET_TEST_RUNNER));
  set('authApproach', firstMatch(deps, DOTNET_AUTH));

  return { answers, sources };
}
