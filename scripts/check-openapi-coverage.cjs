const fs = require('fs');

const routesFile = fs.readFileSync('src/routes/index.ts', 'utf8');
const openApiFile = fs.readFileSync('src/docs/openapi.ts', 'utf8');

const routeOps = [];
for (const line of routesFile.split('\n')) {
  const match = line.match(/router\.(get|post|delete)\('([^']+)'/);
  if (!match) {
    continue;
  }

  const method = match[1];
  const path = match[2].replace(':sessionId', '{sessionId}');
  routeOps.push(`${method} ${path}`);
}

const openApiOps = new Set();

// Static path operations
const staticPathRegex = /'\/(?:[^'\\]|\\.)*':\s*\{([\s\S]*?)\n  \},/g;
let staticMatch;
while ((staticMatch = staticPathRegex.exec(openApiFile)) !== null) {
  const pathEntry = staticMatch[0].match(/'([^']+)'/)?.[1];
  const body = staticMatch[1] || '';
  if (!pathEntry) {
    continue;
  }

  for (const method of ['get', 'post', 'delete']) {
    if (new RegExp(`\\b${method}:\\s*\\{`).test(body)) {
      openApiOps.add(`${method} ${pathEntry}`);
    }
  }

}

// Dynamic post route entries in postRoutes array
const postRoutePathRegex = /path:\s*'([^']+)'/g;
let postMatch;
while ((postMatch = postRoutePathRegex.exec(openApiFile)) !== null) {
  openApiOps.add(`post ${postMatch[1]}`);
}

const missing = routeOps.filter((op) => !openApiOps.has(op));

if (missing.length > 0) {
  console.error('OpenAPI coverage check failed. Missing operations:');
  for (const op of missing) {
    console.error(`- ${op}`);
  }
  process.exit(1);
}

console.log(`OpenAPI coverage check passed: ${routeOps.length} route operations documented.`);
