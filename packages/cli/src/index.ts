#!/usr/bin/env node

const commands: Record<string, () => void> = {
  init: () => console.log('f3s init — scaffold a new 3D tool from template'),
  check: () => console.log('f3s check — run compliance checks'),
  publish: () => console.log('f3s publish — publish tool to free3dstore.online'),
  help: () => {
    console.log('f3s — CLI for Free3DStore');
    console.log('');
    console.log('Commands:');
    console.log('  init      Scaffold a new 3D tool from template');
    console.log('  check     Run compliance checks');
    console.log('  publish   Publish tool to free3dstore.online');
    console.log('  help      Show this help');
  },
};

const cmd = process.argv[2];
const handler = commands[cmd ?? 'help'] ?? commands.help!;
handler();
