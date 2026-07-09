import type { TechModule } from '../../types';
import { isPhp } from '../../predicates';
import { guidanceSection } from '../section';

/** Laravel — PHP full-stack MVC framework. */
export const laravel: TechModule = {
  id: 'laravel',
  title: 'Laravel',
  category: 'framework',
  appliesTo: (a) => isPhp(a) && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'laravel', label: 'Laravel', hint: 'recommended' }],
  questions: () => [
    {
      id: 'laravel.frontend',
      type: 'select',
      summary: 'Frontend',
      message: 'Frontend stack?',
      options: [
        { value: 'blade', label: 'Blade templates', hint: 'recommended' },
        { value: 'inertia-vue', label: 'Inertia + Vue' },
        { value: 'inertia-react', label: 'Inertia + React' },
        { value: 'livewire', label: 'Livewire' },
        { value: 'api-only', label: 'API only (no server-rendered UI)' },
      ],
    },
    {
      id: 'laravel.structure',
      type: 'select',
      summary: 'Structure',
      message: 'Application structure?',
      options: [
        { value: 'standard', label: 'Standard (app/Http, app/Models)', hint: 'recommended' },
        { value: 'modular', label: 'Modular / domain-driven (per-domain modules)' },
      ],
    },
    {
      id: 'laravel.queue',
      type: 'select',
      summary: 'Queue driver',
      message: 'Queue / background-job driver?',
      options: [
        { value: 'database', label: 'Database', hint: 'recommended' },
        { value: 'redis', label: 'Redis' },
        { value: 'sync', label: 'Sync (no background processing)' },
      ],
    },
  ],
  scaffold: () => 'composer create-project laravel/laravel <app>',
  devCommand: () => 'php artisan serve',
  testCommand: () => 'php artisan test',
  guidance: (a) => {
    const front = a['laravel.frontend'];
    const lines = [
      '- Keep controllers thin: put business logic in service/action classes and route model binding; controllers only orchestrate.',
      '- Validate request input with Form Request classes (`php artisan make:request`), not inline `$request->validate()` for anything non-trivial.',
      '- Eloquent models live in `app/Models`; declare `$fillable` (or `$guarded`) explicitly to avoid mass-assignment vulnerabilities.',
      '- Schema changes go through migrations in `database/migrations`; never edit the DB by hand. Seed with factories/seeders.',
      '- Read config through `config()` and env only inside `config/*.php` — calling `env()` outside config breaks when config is cached (`php artisan config:cache`).',
      '- Use `php artisan` generators (`make:model -mfc`, `make:controller`, `make:policy`) to stay on framework conventions.',
    ];
    if (front === 'livewire') {
      lines.push(
        '- Livewire components: keep state minimal and server-authoritative; guard actions with policies, never trust client-emitted values.',
      );
    } else if (front === 'inertia-vue' || front === 'inertia-react') {
      lines.push(
        '- Inertia: pass only the props each page needs; share global data via `HandleInertiaRequests` middleware, not per-controller.',
      );
    } else if (front === 'blade') {
      lines.push(
        '- Blade: escape output with `{{ }}` (auto-escaped); reserve `{!! !!}` for trusted HTML only. Extract shared markup into components.',
      );
    }
    return guidanceSection('Laravel', lines);
  },
};
