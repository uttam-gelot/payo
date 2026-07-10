import type { TechModule } from '../../types';
import { isJava } from '../../predicates';
import { guidanceSection } from '../section';

/** Whether the build tool is Gradle (Maven is the default when unset). */
const isGradle = (pm: unknown): boolean => pm === 'gradle';

/** Spring Boot — the dominant convention-over-configuration framework for the JVM. */
export const springBoot: TechModule = {
  id: 'spring-boot',
  title: 'Spring Boot',
  category: 'framework',
  appliesTo: (a) => isJava(a) && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'spring-boot', label: 'Spring Boot', hint: 'recommended' }],
  questions: () => [
    {
      id: 'spring-boot.web',
      type: 'select',
      summary: 'Web stack',
      message: 'Web stack?',
      options: [
        { value: 'mvc', label: 'Spring MVC (servlet, blocking)', hint: 'recommended' },
        { value: 'webflux', label: 'Spring WebFlux (reactive)' },
      ],
    },
    {
      id: 'spring-boot.structure',
      type: 'select',
      summary: 'Structure',
      message: 'Package structure?',
      options: [
        {
          value: 'layered',
          label: 'Layered (controller / service / repository)',
          hint: 'recommended',
        },
        { value: 'hexagonal', label: 'Hexagonal (ports & adapters)' },
        { value: 'modular', label: 'Modular monolith (feature packages)' },
      ],
    },
    {
      id: 'spring-boot.di',
      type: 'confirm',
      summary: 'Constructor injection',
      message: 'Use constructor injection and typed @ConfigurationProperties for config?',
      recommended: true,
    },
  ],
  scaffold: (a) =>
    `spring init --build=${isGradle(a.packageManager) ? 'gradle' : 'maven'} --dependencies=web,data-jpa <App>`,
  devCommand: (a) => (isGradle(a.packageManager) ? './gradlew bootRun' : './mvnw spring-boot:run'),
  testCommand: (a) => (isGradle(a.packageManager) ? './gradlew test' : './mvnw test'),
  buildCommand: (a) => (isGradle(a.packageManager) ? './gradlew build' : './mvnw package'),
  guidance: (a) => {
    const lines = [
      '- Prefer constructor injection (final fields) over `@Autowired` on fields — it keeps beans immutable and unit-testable without the container.',
      '- Keep controllers thin: they validate input, delegate to a `@Service`, and map to DTOs. Never return JPA entities directly from an endpoint.',
      '- Put transaction boundaries on service methods with `@Transactional`; do not span transactions across the web layer.',
      '- Bind configuration to typed `@ConfigurationProperties` classes and use Spring profiles (`application-<profile>.yml`) — avoid scattered `@Value` lookups.',
      '- Validate request bodies at the boundary with `@Valid` + Bean Validation; return a consistent error shape via `@ControllerAdvice`.',
      '- Never commit secrets to `application.yml`; read them from environment variables / a secrets manager.',
    ];
    if (a['spring-boot.web'] === 'webflux') {
      lines.push(
        '- WebFlux: return `Mono`/`Flux` end-to-end and never call blocking APIs on the event loop; use `R2DBC` or reactive drivers, not blocking JDBC.',
      );
    } else {
      lines.push(
        '- MVC: keep request handling non-blocking where it matters, and offload long work to `@Async` / a task executor rather than holding the servlet thread.',
      );
    }
    return guidanceSection('Spring Boot', lines);
  },
};
