export function formatTransportError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('ENOENT') || msg.includes('ECONNREFUSED')) {
    return [
      `ncl: cannot reach NewClaw host (${msg}).`,
      `Is the host running? Start it with: pnpm run dev`,
      `Or, if installed as a service:`,
      `  macOS:  launchctl kickstart -k gui/$(id -u)/com.newclaw`,
      `  Linux:  systemctl --user restart newclaw`,
      ``,
    ].join('\n');
  }
  return `ncl: transport error: ${msg}\n`;
}
