const fs = require('fs');
let content = fs.readFileSync('src/services/mesStore.ts', 'utf8');

content = content.replace(
  "public getMachines(): Machine[] {\n    return this.machines;\n  }",
  "public getMachines(): Machine[] {\n    return this.machines.filter(m => m.status !== 'LEGADO' && m.status !== 'INATIVA');\n  }"
);

fs.writeFileSync('src/services/mesStore.ts', content);
console.log('done getMachines');
