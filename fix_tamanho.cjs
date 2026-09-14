const fs = require('fs');
let content = fs.readFileSync('src/types/mes.ts', 'utf8');
content = content.replace('medidasFormatadas: string;', 'medidasFormatadas: string;\n  tamanho?: string;');
fs.writeFileSync('src/types/mes.ts', content);
