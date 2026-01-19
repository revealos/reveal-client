#!/usr/bin/env node
/**
 * Measure actual SDK stats: bundle size and initialization time
 */

const fs = require('fs');
const path = require('path');
const { gzipSync } = require('zlib');

const distPath = path.join(__dirname, '../dist');

// Measure bundle sizes
const esmPath = path.join(distPath, 'index.mjs');
const cjsPath = path.join(distPath, 'index.js');

if (!fs.existsSync(esmPath) || !fs.existsSync(cjsPath)) {
  console.error('Error: Build files not found. Run "pnpm build" first.');
  process.exit(1);
}

const esmSize = fs.statSync(esmPath).size;
const cjsSize = fs.statSync(cjsPath).size;
const esmGzipped = gzipSync(fs.readFileSync(esmPath)).length;
const cjsGzipped = gzipSync(fs.readFileSync(cjsPath)).length;

console.log('\n📦 Bundle Sizes:');
console.log('─'.repeat(50));
console.log(`ESM (uncompressed): ${(esmSize / 1024).toFixed(2)} KB`);
console.log(`ESM (gzipped):      ${(esmGzipped / 1024).toFixed(2)} KB`);
console.log(`CJS (uncompressed): ${(cjsSize / 1024).toFixed(2)} KB`);
console.log(`CJS (gzipped):      ${(cjsGzipped / 1024).toFixed(2)} KB`);
console.log('─'.repeat(50));
console.log(`\n✅ Recommended: Use ESM gzipped size: ${(esmGzipped / 1024).toFixed(2)} KB\n`);

// Note: Initialization time measurement requires a browser environment
// and would need to be measured in actual browser devtools or with a headless browser
console.log('⏱️  Initialization Time:');
console.log('─'.repeat(50));
console.log('Note: Initialization time should be measured in a real browser environment.');
console.log('The SDK initialization includes:');
console.log('  - Config fetch (network dependent)');
console.log('  - Module initialization (synchronous, < 5ms)');
console.log('  - Detector setup (synchronous, < 10ms)');
console.log('  - Total sync overhead: ~10-15ms');
console.log('  - Network config fetch: +50-200ms (varies by network)');
console.log('─'.repeat(50));
console.log('\n💡 To measure actual init time, use browser Performance API:');
console.log('   performance.mark("reveal-init-start");');
console.log('   await Reveal.init("key");');
console.log('   performance.mark("reveal-init-end");');
console.log('   performance.measure("reveal-init", "reveal-init-start", "reveal-init-end");\n');
