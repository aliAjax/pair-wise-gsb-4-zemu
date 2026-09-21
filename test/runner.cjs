#!/usr/bin/env node
// 测试运行器：tsc 把 domain 层与用例转译为 CJS 后用 Node 执行（typescript 是现有依赖，未新增）
const { execSync } = require('node:child_process');
const fs = require('node:fs');
execSync('npx tsc -p tsconfig.test.json', { stdio: 'inherit' });
fs.writeFileSync('.dist-test/package.json', JSON.stringify({ type: 'commonjs' }));
require('../.dist-test/test/run.js');
