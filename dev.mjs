import { spawn } from 'node:child_process';

const children = [];

function run(cmd, args, name, color) {
  const p = spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    cwd: process.cwd(),
  });
  const tag = `\x1b[${color}m[${name}]\x1b[0m`;
  const line = (stream) => (d) =>
    d
      .toString()
      .replace(/\s+$/, '')
      .split('\n')
      .forEach((l) => l && console.log(tag, l));
  p.stdout?.on('data', line('stdout'));
  p.stderr?.on('data', line('stderr'));
  p.on('exit', (code) => console.log(`${tag} 进程退出，code=${code}`));
  children.push(p);
  return p;
}

console.log('\x1b[35m[dev]\x1b[0m 启动 webpack watch + CORS 静态服务器(5501)...');
run('pnpm', ['run', 'watch'], 'watch', '36');
run('node', ['serve-dist.mjs'], 'serve', '35');

const killAll = () => {
  children.forEach((p) => {
    try {
      process.kill(-p.pid);
    } catch {
      try {
        p.kill();
      } catch {}
    }
  });
  process.exit(0);
};
process.on('SIGINT', killAll);
process.on('SIGTERM', killAll);
