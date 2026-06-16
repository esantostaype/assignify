// scripts/explore-folder.js
// Ejecutar con: node scripts/explore-folder.js

// eslint-disable-next-line @typescript-eslint/no-require-imports
const axios = require('axios');

// Token leído del entorno. Ejecuta: node --env-file=.env scripts/explore-folder.js
const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;
if (!CLICKUP_TOKEN) {
  console.error('❌ Falta CLICKUP_API_TOKEN en el entorno (.env)');
  process.exit(1);
}
const FOLDER_ID = '90132231450'; // ID del folder "Brands"

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

const headers = {
  'Authorization': CLICKUP_TOKEN,
  'Content-Type': 'application/json'
};

async function exploreFolder() {
  try {
    console.log('🔍 Explorando folder "Brands"...\n');

    // 1. Obtener listas dentro del folder
    console.log('📝 LISTS en el folder "Brands":');
    const listsResponse = await axios.get(`${CLICKUP_API_BASE}/folder/${FOLDER_ID}/list`, { headers });
    
    if (listsResponse.data.lists.length === 0) {
      console.log('  - Sin listas en este folder');
      console.log('\n💡 Necesitas crear una lista para poder crear tareas.');
      console.log('Puedes crearla manualmente en ClickUp o usar el script create-list.js');
    } else {
      listsResponse.data.lists.forEach(list => {
        console.log(`  - ${list.name} (ID: ${list.id})`);
        console.log(`    Status: ${list.archived ? 'Archivada' : 'Activa'}`);
        console.log(`    Tareas: ${list.task_count || 0}`);
      });

      // 2. Obtener detalles de la primera lista encontrada
      const firstList = listsResponse.data.lists[0];
      console.log(`\n🔍 Detalles de "${firstList.name}":`);
      
      const listDetailsResponse = await axios.get(`${CLICKUP_API_BASE}/list/${firstList.id}`, { headers });
      const listDetails = listDetailsResponse.data;
      
      console.log('\n🏷️ STATUSES DISPONIBLES:');
      listDetails.statuses.forEach(status => {
        console.log(`   - ${status.status} (${status.type})`);
      });
      
      console.log('\n🎯 CAMPOS PERSONALIZADOS:');
      if (listDetails.fields && listDetails.fields.length > 0) {
        listDetails.fields.forEach(field => {
          console.log(`   - ${field.name} (${field.type}) - ID: ${field.id}`);
        });
      } else {
        console.log('   - Sin campos personalizados');
      }
    }

    // 3. Mostrar configuración actualizada
    console.log('\n📄 CONFIGURACIÓN ACTUALIZADA PARA .env.local:');
    console.log('===============================================');
    console.log(`CLICKUP_API_TOKEN=${CLICKUP_TOKEN}`);
    console.log(`CLICKUP_TEAM_ID=9017044866`);
    console.log(`CLICKUP_SPACE_ID=90170091121`);
    console.log(`CLICKUP_FOLDER_ID=90170099166`);
    
    if (listsResponse.data.lists.length > 0) {
      console.log(`CLICKUP_LIST_ID=${listsResponse.data.lists[0].id}`);
    } else {
      console.log('# CLICKUP_LIST_ID=PENDIENTE_DE_CREAR');
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

exploreFolder();