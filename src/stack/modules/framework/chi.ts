import type { TechModule } from '../../types';

/** Chi — idiomatic net/http Go router. */
export const chi: TechModule = {
  id: 'chi',
  title: 'Chi',
  category: 'framework',
  appliesTo: (a) =>
    a.language === 'go' && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'chi', label: 'Chi' }],
  questions: () => [
    {
      id: 'chi.structure',
      type: 'select',
      summary: 'Structure',
      message: 'Application structure?',
      options: [
        { value: 'layered', label: 'handler / service / repository', hint: 'recommended' },
        { value: 'flat', label: 'Flat package layout' },
      ],
    },
    {
      id: 'chi.stdlib',
      type: 'confirm',
      summary: 'net/http handlers',
      message: 'Keep handlers net/http-compatible (http.HandlerFunc)?',
      recommended: true,
    },
  ],
  scaffold: () => 'go mod init <module>',
  devCommand: () => 'go run ./...',
  testCommand: () => 'go test ./...',
  buildCommand: () => 'go build ./...',
};
