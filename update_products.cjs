const fs = require('fs');
const content = fs.readFileSync('src/data/initialData.ts', 'utf8');

// Match INITIAL_PRODUCTS array
const startIdx = content.indexOf('export const INITIAL_PRODUCTS');
if (startIdx === -1) throw new Error('Not found');

let data = content.substring(startIdx);

// Remove unused processes from defaultProcessSequence
data = data.replace(/'proc_carrossel', /g, '');
data = data.replace(/'proc_colocar_alca', /g, '');
data = data.replace(/'proc_passar_fio', /g, '');
data = data.replace(/'proc_acabamento', /g, '');
data = data.replace(/'proc_expedicao'/g, "''"); // just in case it's at the end
data = data.replace(/, ''/g, ""); // clean up
data = data.replace(/'proc_expedicao', /g, '');
data = data.replace(/, 'proc_expedicao'/g, '');

// Clean compatibleMachineIds
data = data.replace(/'mach_carrossel_01'/g, "'CARROSSEL_01'");
data = data.replace(/'mach_carrossel_02'/g, "'CARROSSEL_PEQUENA_01'");
data = data.replace(/'mach_alca_01', 'mach_alca_02'/g, '');
data = data.replace(/'mach_alca_01'/g, '');
data = data.replace(/'mach_fio_01'/g, '');
data = data.replace(/, ''/g, ""); // clean up
data = data.replace(/, ]/g, "]");
data = data.replace(/\[, /g, "[");
data = data.replace(/, ,/g, ",");

let newContent = content.substring(0, startIdx) + data;
fs.writeFileSync('src/data/initialData.ts', newContent);
console.log('done products');
