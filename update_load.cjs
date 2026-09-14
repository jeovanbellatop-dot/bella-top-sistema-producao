const fs = require('fs');
let content = fs.readFileSync('src/services/mesStore.ts', 'utf8');

const replacement = `
      const storedMachines = localStorage.getItem(STORAGE_KEYS.MACHINES);
      let parsedMachines = storedMachines ? JSON.parse(storedMachines) : INITIAL_MACHINES;
      
      // Limpeza de máquinas fictícias/antigas
      const officialMachineIds = INITIAL_MACHINES.map(m => m.id);
      
      this.machines = parsedMachines.filter((m: any) => {
        if (officialMachineIds.includes(m.id)) {
          // Atualiza as máquinas oficiais com as configurações hardcoded mais recentes (ex: M1 em Manutenção)
          const official = INITIAL_MACHINES.find(om => om.id === m.id);
          Object.assign(m, official);
          return true;
        }
        
        // Verifica se a máquina antiga possui algum histórico/ordem vinculada
        const storedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
        let hasHistory = false;
        if (storedOrders) {
          const orders = JSON.parse(storedOrders);
          hasHistory = orders.some((o: any) => o.routingSteps?.some((s: any) => s.assignedMachineId === m.id));
        }
        
        if (hasHistory) {
          m.status = 'LEGADO';
          m.isActive = false;
          return true; // mantém como legado
        }
        
        return false; // remove
      });
`;

content = content.replace(
  /const storedMachines = localStorage\.getItem\(STORAGE_KEYS\.MACHINES\);\s*this\.machines = storedMachines \? JSON\.parse\(storedMachines\) : INITIAL_MACHINES;/g,
  replacement
);

fs.writeFileSync('src/services/mesStore.ts', content);
console.log('done load');
