/**
 * Em produção o console deve ficar sempre limpo.
 * Nenhum log, aviso ou erro é impresso no navegador do lojista
 * (o monitoramento continua funcionando via logger/Telegram).
 */
export function silenceConsoleInProduction() {
  if (typeof window === "undefined") return;
  if (import.meta.env.DEV) return;

  const noop = () => {};
  const methods: (keyof Console)[] = [
    "log",
    "info",
    "warn",
    "error",
    "debug",
    "trace",
    "table",
    "dir",
    "group",
    "groupCollapsed",
    "groupEnd",
    "time",
    "timeEnd",
    "timeLog",
    "count",
    "assert",
  ];

  for (const method of methods) {
    try {
      (console as unknown as Record<string, unknown>)[method as string] = noop;
    } catch {
      // ignore
    }
  }
}
