// scripts/get-clickup-ids.js
// Ejecutar con: node scripts/get-clickup-ids.js

// eslint-disable-next-line @typescript-eslint/no-require-imports
const axios = require('axios');

// Token leído del entorno. Ejecuta: node --env-file=.env scripts/get-clickup-ids.js
const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;
if (!CLICKUP_TOKEN) {
  console.error('❌ Falta CLICKUP_API_TOKEN en el entorno (.env)');
  process.exit(1);
}

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

const headers = {
  'Authorization': CLICKUP_TOKEN,
  'Content-Type': 'application/json'
};

async function getClickUpIDs() {
  try {
    console.log('🔍 Obteniendo información de ClickUp...\n');

    // 1. Obtener Teams (Workspaces)
    console.log('📋 TEAMS/WORKSPACES:');
    const teamsResponse = await axios.get(`${CLICKUP_API_BASE}/team`, { headers });
    
    teamsResponse.data.teams.forEach(team => {
      console.log(`- ${team.name} (ID: ${team.id})`);
    });
    
    if (teamsResponse.data.teams.length === 0) {
      console.log('❌ No se encontraron teams');
      return;
    }

    const teamId = teamsResponse.data.teams[0].id;
    console.log(`\n✅ Usando Team ID: ${teamId}\n`);

    // 2. Obtener Spaces
    console.log('🏢 SPACES:');
    const spacesResponse = await axios.get(`${CLICKUP_API_BASE}/team/${teamId}/space`, { headers });
    
    spacesResponse.data.spaces.forEach(space => {
      console.log(`- ${space.name} (ID: ${space.id})`);
    });

    if (spacesResponse.data.spaces.length === 0) {
      console.log('❌ No se encontraron spaces');
      return;
    }

    // 3. Obtener Folders para cada Space
    for (const space of spacesResponse.data.spaces) {
      console.log(`\n📁 FOLDERS en "${space.name}":`);
      
      try {
        const foldersResponse = await axios.get(`${CLICKUP_API_BASE}/space/${space.id}/folder`, { headers });
        
        if (foldersResponse.data.folders.length === 0) {
          console.log('  - Sin folders');
        } else {
          foldersResponse.data.folders.forEach(folder => {
            console.log(`  - ${folder.name} (ID: ${folder.id})`);
          });
        }
      } catch (error) {
        console.log(`${ error } Error obteniendo folders`);
      }

      // 4. Obtener Lists directamente del Space (folderless lists)
      console.log(`\n📝 LISTS en "${space.name}" (sin folder):`);
      
      try {
        const listsResponse = await axios.get(`${CLICKUP_API_BASE}/space/${space.id}/list`, { headers });
        
        if (listsResponse.data.lists.length === 0) {
          console.log('  - Sin listas');
        } else {
          listsResponse.data.lists.forEach(list => {
            console.log(`  - ${list.name} (ID: ${list.id})`);
          });
        }
      } catch (error) {
        console.log(`${ error } Error obteniendo listas`);
      }
    }

    // 5. Obtener Users del Team
    console.log(`\n👥 USERS en el Team:`);
    try {
      const usersResponse = await axios.get(`${CLICKUP_API_BASE}/team/${teamId}/member`, { headers });
      
      usersResponse.data.members.forEach(member => {
        console.log(`- ${member.user.username} (${member.user.email}) - ID: ${member.user.id}`);
      });
    } catch (error) {
      console.log(`${ error } ❌ Error obteniendo usuarios`);
    }

    // 6. Generar archivo .env de ejemplo
    console.log('\n📄 CONFIGURACIÓN SUGERIDA PARA .env.local:');
    console.log('===============================================');
    console.log(`CLICKUP_API_TOKEN=${CLICKUP_TOKEN}`);
    console.log(`CLICKUP_TEAM_ID=${teamId}`);
    
    if (spacesResponse.data.spaces.length > 0) {
      console.log(`CLICKUP_SPACE_ID=${spacesResponse.data.spaces[0].id}`);
    }

    console.log('\n💡 PRÓXIMOS PASOS:');
    console.log('1. Copia las IDs que necesites del output anterior');
    console.log('2. Agrega las variables de entorno a tu .env.local');
    console.log('3. Decide en qué List quieres crear las tareas');
    console.log('4. Usa get-list-details.js para obtener más info de una lista específica');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n🔑 Tu token parece inválido. Verifica:');
      console.log('1. Que copiaste el token completo');
      console.log('2. Que el token no haya expirado');
      console.log('3. Que tengas permisos en el workspace');
    }
  }
}

// Función para obtener detalles de una lista específica
async function getListDetails(listId) {
  try {
    console.log(`🔍 Obteniendo detalles de la lista ${listId}...\n`);
    
    const listResponse = await axios.get(`${CLICKUP_API_BASE}/list/${listId}`, { headers });
    const list = listResponse.data;
    
    console.log(`📝 LISTA: ${list.name}`);
    console.log(`   ID: ${list.id}`);
    console.log(`   Status: ${list.archived ? 'Archivada' : 'Activa'}`);
    
    console.log('\n🏷️ STATUSES DISPONIBLES:');
    list.statuses.forEach(status => {
      console.log(`   - ${status.status} (${status.type}) - Color: ${status.color}`);
    });
    
    console.log('\n🎯 CUSTOM FIELDS:');
    if (list.fields && list.fields.length > 0) {
      list.fields.forEach(field => {
        console.log(`   - ${field.name} (${field.type}) - ID: ${field.id}`);
      });
    } else {
      console.log('   - Sin campos personalizados');
    }
    
  } catch (error) {
    console.error('❌ Error obteniendo detalles de lista:', error.response?.data || error.message);
  }
}

// Ejecutar el script principal
if (process.argv.includes('--list') && process.argv[3]) {
  getListDetails(process.argv[3]);
} else {
  getClickUpIDs();
}