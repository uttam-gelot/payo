import type { TechModule } from '../../types';
import { isJava, isSqlDb } from '../../predicates';
import { guidanceSection } from '../section';

const isGradle = (pm: unknown): boolean => pm === 'gradle';

/** Spring Data JPA — the JPA/Hibernate data-access layer used by most Spring Boot apps. */
export const springDataJpa: TechModule = {
  id: 'spring-data-jpa',
  title: 'Spring Data JPA',
  category: 'orm',
  appliesTo: (a) => isJava(a) && isSqlDb(a),
  options: () => [
    { value: 'spring-data-jpa', label: 'Spring Data JPA (Hibernate)', hint: 'recommended' },
  ],
  questions: () => [
    {
      id: 'spring-data-jpa.migrations',
      type: 'select',
      summary: 'Schema management',
      message: 'Schema management?',
      options: [
        { value: 'flyway', label: 'Flyway migrations', hint: 'recommended' },
        { value: 'liquibase', label: 'Liquibase migrations' },
        { value: 'hibernate-ddl', label: 'Hibernate ddl-auto (dev only)' },
      ],
    },
    {
      id: 'spring-data-jpa.keys',
      type: 'select',
      summary: 'Primary keys',
      message: 'Primary key strategy?',
      options: [
        { value: 'identity', label: 'Auto-increment identity', hint: 'recommended' },
        { value: 'uuid', label: 'UUIDs' },
      ],
    },
  ],
  migrateCommand: (a) => {
    const gradle = isGradle(a.packageManager);
    switch (a['spring-data-jpa.migrations']) {
      case 'liquibase':
        return gradle ? './gradlew update' : './mvnw liquibase:update';
      case 'hibernate-ddl':
        return 'Schema applied automatically by Hibernate `ddl-auto` on startup (dev only)';
      default:
        return gradle ? './gradlew flywayMigrate' : './mvnw flyway:migrate';
    }
  },
  guidance: () =>
    guidanceSection('Spring Data JPA', [
      '- Define entities with JPA annotations and let repositories extend `JpaRepository<T, ID>`; write custom queries with derived method names or `@Query`, not string concatenation.',
      '- Never expose `@Entity` classes across the web boundary — map to DTOs (records) so lazy-loading and serialization concerns stay in the persistence layer.',
      '- Default associations to `FetchType.LAZY`; fetch what a use case needs with `@EntityGraph` or `join fetch` to avoid N+1 queries.',
      '- Manage schema with Flyway/Liquibase migrations under `src/main/resources/db/migration`; keep `spring.jpa.hibernate.ddl-auto=validate` (never `update`/`create`) outside local dev.',
      '- Keep `@Transactional` on service methods, read-only where possible (`@Transactional(readOnly = true)`); do not open transactions in controllers or repositories.',
    ]),
};
