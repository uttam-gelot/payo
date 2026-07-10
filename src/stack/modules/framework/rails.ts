import type { TechModule } from '../../types';
import { isRuby } from '../../predicates';
import { guidanceSection } from '../section';

/** Ruby on Rails — full-stack MVC framework. */
export const rails: TechModule = {
  id: 'rails',
  title: 'Ruby on Rails',
  category: 'framework',
  appliesTo: (a) => isRuby(a) && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'rails', label: 'Ruby on Rails', hint: 'recommended' }],
  questions: () => [
    {
      id: 'rails.frontend',
      type: 'select',
      summary: 'Frontend',
      message: 'Frontend stack?',
      options: [
        { value: 'hotwire', label: 'Hotwire (Turbo + Stimulus)', hint: 'recommended' },
        { value: 'react', label: 'React / Vue via jsbundling-rails' },
        { value: 'api-only', label: 'API only (no server-rendered UI)' },
      ],
    },
    {
      id: 'rails.jobs',
      type: 'select',
      summary: 'Background jobs',
      message: 'Background-job adapter?',
      options: [
        { value: 'solid-queue', label: 'Solid Queue', hint: 'recommended' },
        { value: 'sidekiq', label: 'Sidekiq' },
        { value: 'inline', label: 'Inline (no background processing)' },
      ],
    },
  ],
  scaffold: () => 'rails new <app>',
  devCommand: () => 'bin/rails server',
  testCommand: () => 'bin/rails test',
  guidance: (a) => {
    const front = a['rails.frontend'];
    const lines = [
      '- Keep controllers thin: put business logic in models, concerns, or service/interactor objects; controllers only orchestrate and render.',
      '- Guard mass-assignment with Strong Parameters (`params.require(...).permit(...)`) — never pass raw `params` to `create`/`update`.',
      '- Schema changes go through migrations in `db/migrate` (`bin/rails g migration`); never edit the schema or DB by hand. Keep `schema.rb` (or `structure.sql`) checked in.',
      '- Eliminate N+1 queries with `includes`/`preload`/`eager_load`; enable `strict_loading` in development to catch them early.',
      '- Store secrets in encrypted credentials (`bin/rails credentials:edit`) or ENV — never commit `config/master.key` or plaintext secrets.',
      '- Lean on Rails generators (`bin/rails g model/scaffold/migration`) and RESTful routes to stay on framework conventions.',
      '- Run background work through Active Job; keep jobs small and idempotent so retries are safe.',
    ];
    if (front === 'hotwire') {
      lines.push(
        '- Hotwire: prefer Turbo Frames / Turbo Streams over custom JS; keep Stimulus controllers small and behavior-focused, driven by server-rendered HTML.',
      );
    } else if (front === 'react') {
      lines.push(
        '- jsbundling-rails: keep the JS build under `app/javascript`; treat Rails as the API/SSR shell and avoid duplicating domain logic in the client.',
      );
    } else if (front === 'api-only') {
      lines.push(
        '- API-only: serialize responses explicitly (e.g. `jbuilder`/`alba`/serializers) — never leak model internals; version the API and return proper status codes.',
      );
    }
    return guidanceSection('Ruby on Rails', lines);
  },
};
