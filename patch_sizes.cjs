const fs = require('fs');
let content = fs.readFileSync('src/services/mesStore.ts', 'utf8');

const regex = /if \(cap\.medidasExclusivas && cap\.medidasExclusivas\.length > 0\)/;

const newLogic = `
          // Validação de Tamanho (PP, P, M, G, GG)
          const tamanho = (opData.tamanho || '').toUpperCase();
          const tamanhos = ['PP', 'P', 'M', 'G', 'GG'];
          const idxTamanho = tamanhos.indexOf(tamanho);
          
          if (idxTamanho !== -1) {
            if (cap.tamanhoMinimo && tamanhos.indexOf(cap.tamanhoMinimo) > idxTamanho) {
              return false; // Máquina não suporta tamanho tão pequeno
            }
            if (cap.tamanhoMaximo && tamanhos.indexOf(cap.tamanhoMaximo) < idxTamanho) {
              return false; // Máquina não suporta tamanho tão grande
            }
          }

          if (cap.medidasExclusivas && cap.medidasExclusivas.length > 0)`;

content = content.replace(regex, newLogic);
fs.writeFileSync('src/services/mesStore.ts', content);
console.log('done patching sizes');
