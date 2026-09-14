const fs = require('fs');
let content = fs.readFileSync('src/components/dashboard/FactoryOverview.tsx', 'utf8');

const regex = /<div className="bg-white border border-\[\#E5DAD3\] p-4 rounded-xl flex flex-col justify-between">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const newStats = `
        {/* Total Machines */}
        <div className="bg-white border border-[#E5DAD3] p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6E615B]">
            <span className="text-xs font-medium uppercase tracking-wider">Máquinas Cadastradas</span>
            <Cpu className="w-4 h-4 text-[#6E615B]" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-[#1C1418]">{totalMachines}</div>
            <div className="text-[11px] text-emerald-500 font-medium mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {machines.filter(m => m.status !== 'MANUTENCAO').length} Operacionais
            </div>
          </div>
        </div>

        {/* Unavailable Machines */}
        <div className="bg-white border border-[#E5DAD3] p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6E615B]">
            <span className="text-xs font-medium uppercase tracking-wider">Indisponíveis</span>
            <PauseCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-rose-500">{machines.filter(m => m.status === 'MANUTENCAO').length}</div>
            <div className="text-[11px] text-[#6E615B] mt-0.5">
              Em Manutenção
            </div>
          </div>
        </div>
`;

// I need to carefully replace just the first two divs of the grid
content = content.replace(
  /\{\/\* Total Machines \*\/\}([\s\S]*?)\{\/\* OPs in Production \*\/\}/,
  newStats + "\n        {/* OPs in Production */}"
);

fs.writeFileSync('src/components/dashboard/FactoryOverview.tsx', content);
console.log('done dashboard');
