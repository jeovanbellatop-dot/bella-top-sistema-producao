const fs = require('fs');
let content = fs.readFileSync('src/types/mes.ts', 'utf8');

// Revert UserRole mess
content = content.replace("  | 'MANUTENCAO'\n  | 'LEGADO'\n  | 'LEGADO'\n  | 'EXPEDITION';", "  | 'MANUTENCAO'\n  | 'EXPEDITION';");
// Actually, earlier it was just | 'MANUTENCAO' then maybe it had | 'LEGADO' added?
// Let's just fix UserRole precisely:
content = content.replace(/export type UserRole =([\s\S]*?);/, "export type UserRole =\n  | 'ADMIN'\n  | 'PCP'\n  | 'MANAGER'\n  | 'LIDER'\n  | 'OPERATOR'\n  | 'QUALIDADE'\n  | 'MANUTENCAO'\n  | 'EXPEDITION';");

// Fix MachineStatus type
content = content.replace(/export type MachineStatus =([\s\S]*?);/, "export type MachineStatus =\n  | 'DISPONIVEL'\n  | 'SETUP'\n  | 'PRODUZINDO'\n  | 'PAUSADA'\n  | 'MANUTENCAO'\n  | 'LEGADO'\n  | 'QUALIDADE'\n  | 'INATIVA';");

fs.writeFileSync('src/types/mes.ts', content);
console.log('done fixing types');
