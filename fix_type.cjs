const fs = require('fs');
let content = fs.readFileSync('src/types/mes.ts', 'utf8');

// Fix MachineStatus type
content = content.replace("  | 'MANUTENCAO'", "  | 'MANUTENCAO'\n  | 'LEGADO'");

// Fix capabilities required fields
content = content.replace("permiteVisor: boolean;", "permiteVisor?: boolean;");
content = content.replace("permiteSemVisor: boolean;", "permiteSemVisor?: boolean;");
content = content.replace("permiteAlcaVazada: boolean;", "permiteAlcaVazada?: boolean;");

fs.writeFileSync('src/types/mes.ts', content);
console.log('done fixing types');
