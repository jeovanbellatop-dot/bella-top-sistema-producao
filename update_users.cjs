const fs = require('fs');
let content = fs.readFileSync('src/data/initialData.ts', 'utf8');

content = content.replace(/'mach_refile_01', 'mach_refile_02'/g, "'REFILADEIRA_01'");
content = content.replace(/'mach_flexo_01', 'mach_flexo_02'/g, "'FLEXOGRAFIA_01'");
content = content.replace(/'mach_serigrafia_01'/g, "'CARROSSEL_01', 'CARROSSEL_PEQUENA_01'");
content = content.replace(/name: 'Viola',/g, "name: 'Toninho',");

fs.writeFileSync('src/data/initialData.ts', content);
console.log('done users');
