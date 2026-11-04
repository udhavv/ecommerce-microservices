import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SERVICES = [
  { name: 'auth', port: 4000, dir: 'auth', color: '\x1b[36m' },          // Cyan
  { name: 'product', port: 4001, dir: 'product', color: '\x1b[32m' },    // Green
  { name: 'inventory', port: 4002, dir: 'inventory', color: '\x1b[33m' },// Yellow
  { name: 'orders', port: 4003, dir: 'orders', color: '\x1b[35m' },      // Magenta
  { name: 'payment', port: 4004, dir: 'payment', color: '\x1b[34m' },    // Blue
  { name: 'review', port: 4005, dir: 'review_section', color: '\x1b[31m' }, // Red
];

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

console.log(`${BOLD}\x1b[32m============================================================${RESET}`);
console.log(`${BOLD}\x1b[32m Booting all 6 Microservices (All streaming to Grafana Loki) ${RESET}`);
console.log(`${BOLD}\x1b[32m============================================================${RESET}\n`);

const processes = [];

SERVICES.forEach((svc) => {
  const serviceDir = path.join(__dirname, svc.dir);
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  const child = spawn(npmCmd, ['run', 'dev'], {
    cwd: serviceDir,
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  const prefix = `${svc.color}${BOLD}[${svc.name.padEnd(9)}]${RESET} `;

  child.stdout.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    lines.forEach((line) => {
      if (line.trim()) {
        console.log(`${prefix}${line}`);
      }
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    lines.forEach((line) => {
      if (line.trim()) {
        console.error(`${prefix}${line}`);
      }
    });
  });

  child.on('close', (code) => {
    console.log(`${prefix}exited with code ${code}`);
  });

  processes.push(child);
});

// Clean shutdown on Ctrl+C / SIGINT
function cleanup() {
  console.log(`\n${BOLD}Shutting down all microservices...${RESET}`);
  processes.forEach((p) => {
    try {
      p.kill('SIGINT');
    } catch {
      // Ignore errors on process kill
    }
  });
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
