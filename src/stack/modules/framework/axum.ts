import type { TechModule } from '../../types';

/** Axum — Tokio/Tower-based Rust web framework. Recommended Rust default. */
export const axum: TechModule = {
  id: 'axum',
  title: 'Axum',
  category: 'framework',
  appliesTo: (a) =>
    a.language === 'rust' && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'axum', label: 'Axum', hint: 'recommended' }],
  questions: () => [
    {
      id: 'axum.state',
      type: 'select',
      summary: 'Shared state',
      message: 'Shared application state?',
      options: [
        { value: 'state-extractor', label: 'Typed State extractor', hint: 'recommended' },
        { value: 'extension', label: 'Extension layer' },
      ],
    },
    {
      id: 'axum.errors',
      type: 'confirm',
      summary: 'thiserror + IntoResponse',
      message: 'Map errors via thiserror + IntoResponse?',
      recommended: true,
    },
  ],
  scaffold: () => 'cargo new <app>',
  devCommand: () => 'cargo run',
  testCommand: () => 'cargo test',
  buildCommand: () => 'cargo build --release',
};
