import type { TechModule } from '../../types';
import { isCsharp } from '../../predicates';
import { guidanceSection } from '../section';

/** ASP.NET Core — Microsoft's cross-platform .NET web framework. */
export const aspnetCore: TechModule = {
  id: 'aspnet-core',
  title: 'ASP.NET Core',
  category: 'framework',
  appliesTo: (a) => isCsharp(a) && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'aspnet-core', label: 'ASP.NET Core', hint: 'recommended' }],
  questions: () => [
    {
      id: 'aspnet-core.style',
      type: 'select',
      summary: 'App model',
      message: 'Application model?',
      options: [
        { value: 'minimal-api', label: 'Minimal APIs', hint: 'recommended' },
        { value: 'mvc', label: 'MVC controllers' },
        { value: 'razor-pages', label: 'Razor Pages' },
        { value: 'blazor', label: 'Blazor (Server / WebAssembly)' },
      ],
    },
    {
      id: 'aspnet-core.structure',
      type: 'select',
      summary: 'Structure',
      message: 'Solution structure?',
      options: [
        {
          value: 'layered',
          label: 'Layered (API / Application / Domain / Infrastructure)',
          hint: 'recommended',
        },
        { value: 'vertical-slice', label: 'Vertical slice (feature folders)' },
        { value: 'single-project', label: 'Single project' },
      ],
    },
    {
      id: 'aspnet-core.di',
      type: 'confirm',
      summary: 'Built-in DI + Options',
      message: 'Use the built-in DI container and Options pattern for configuration?',
      recommended: true,
    },
  ],
  scaffold: () => 'dotnet new webapi -o <App>',
  devCommand: () => 'dotnet watch run',
  testCommand: () => 'dotnet test',
  buildCommand: () => 'dotnet build -c Release',
  guidance: (a) => {
    const style = a['aspnet-core.style'];
    const lines = [
      '- Register services and configuration in `Program.cs`; resolve dependencies via constructor injection, never a service locator.',
      '- Bind configuration to strongly-typed options classes (`IOptions<T>`) instead of reading `IConfiguration` keys ad hoc.',
      '- Keep controllers/endpoints thin: put business logic in application/service classes; endpoints only validate, delegate, and map responses.',
      '- Use `async`/`await` end-to-end for I/O; never block on `.Result` / `.Wait()` (deadlocks + thread-pool starvation).',
      '- Return `ProblemDetails` for errors and use a global exception handler; do not leak stack traces to clients.',
      '- Validate input at the boundary (model validation / FluentValidation); treat all client data as untrusted.',
    ];
    if (style === 'minimal-api') {
      lines.push(
        '- Group minimal-API endpoints with `MapGroup` and route handlers in separate files/extension methods — keep `Program.cs` a composition root, not a route dump.',
      );
    } else if (style === 'blazor') {
      lines.push(
        '- Blazor: keep component state minimal and server-authoritative; never trust `[Parameter]` values crossing a trust boundary, and guard actions with policies.',
      );
    } else if (style === 'mvc' || style === 'razor-pages') {
      lines.push(
        '- Razor views auto-HTML-encode output; reserve `Html.Raw` for trusted markup only. Use tag/view components for shared markup.',
      );
    }
    return guidanceSection('ASP.NET Core', lines);
  },
};
