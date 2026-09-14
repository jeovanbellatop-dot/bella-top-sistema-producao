const fs = require('fs');
let content = fs.readFileSync('src/types/mes.ts', 'utf8');
content = content.replace("| 'MANUTENCAO'", "| 'MANUTENCAO'\n  | 'LEGADO'");
content = content.replace("MANUTENCAO: 'Manutenção',", "MANUTENCAO: 'Manutenção',\n  LEGADO: 'Inativa / Legado',");
fs.writeFileSync('src/types/mes.ts', content);
console.log('done type');
