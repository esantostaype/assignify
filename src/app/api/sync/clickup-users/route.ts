// src/app/api/sync/clickup-users/route.ts - Endpoint para sincronizar usuarios de ClickUp

import { NextResponse } from 'next/server';
import axios from 'axios';
import { db } from '@/db';
import { user } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { API_CONFIG } from '@/config';

// Lee/escribe DB y consulta ClickUp en vivo: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;

interface ClickUpUser {
  id: number;
  username: string;
  email: string;
  color: string;
  profilePicture: string;
  initials: string;
  role: number;
  role_key: string;
  last_active: string;
  date_joined: string;
  date_invited: string;
}

interface ClickUpMember {
  user: ClickUpUser;
  invited_by?: {
    id: number;
    username: string;
    email: string;
    status: string;
  };
}

interface ClickUpTeamResponse {
  teams: Array<{
    id: string;
    name: string;
    color: string;
    avatar: string;
    members: ClickUpMember[];
  }>;
}

/**
 * GET /api/sync/clickup-users
 * Obtiene todos los usuarios de ClickUp y los compara con los usuarios locales
 */
export async function GET() {
  if (!CLICKUP_TOKEN) {
    return NextResponse.json({ 
      error: 'CLICKUP_API_TOKEN no configurado' 
    }, { status: 500 });
  }

  try {
    console.log('🔍 Obteniendo usuarios de ClickUp...');

    // Obtener teams del usuario autenticado (el token owner)
    const teamsResponse = await axios.get<ClickUpTeamResponse>(
      `${API_CONFIG.CLICKUP_API_BASE}/team`,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`📊 Teams encontrados: ${teamsResponse.data.teams.length}`);

    // Recopilar todos los usuarios únicos de todos los teams
    const allUsers = new Map<string, ClickUpUser>();
    
    teamsResponse.data.teams.forEach(team => {
      console.log(`   Team: ${team.name} - ${team.members.length} miembros`);
      
      team.members.forEach((member, index) => {
        // ✅ Validación robusta de datos del miembro
        if (!member) {
          console.warn(`     ⚠️ Miembro ${index} es null/undefined`);
          return;
        }

        // ✅ CORRECCIÓN: Acceder a member.user en lugar de member directamente
        const user = member.user;
        if (!user) {
          console.warn(`     ⚠️ Miembro ${index} no tiene objeto user`);
          return;
        }

        if (!user.id) {
          console.warn(`     ⚠️ Usuario ${index} no tiene ID:`, {
            username: user.username || 'unknown',
            email: user.email || 'unknown'
          });
          return;
        }

        // ✅ Validación adicional de campos requeridos
        if (!user.username && !user.email) {
          console.warn(`     ⚠️ Usuario ${user.id} no tiene username ni email`);
          return;
        }

        try {
          const userId = user.id.toString();
          allUsers.set(userId, user);
          console.log(`     ✅ Usuario agregado: ${user.username || user.email} (ID: ${userId})`);
        } catch (conversionError) {
          console.error(`     ❌ Error convirtiendo ID de usuario ${index}:`, conversionError, user);
        }
      });
    });

    const uniqueUsers = Array.from(allUsers.values());
    console.log(`👥 Usuarios únicos encontrados en ClickUp: ${uniqueUsers.length}`);

    // Obtener usuarios existentes en la DB local
    const localUsers = await db.query.user.findMany({
      columns: { id: true, name: true, email: true, active: true }
    });

    console.log(`💾 Usuarios en DB local: ${localUsers.length}`);

    // Crear mapa para comparación rápida
    const localUserIds = new Set(localUsers.map(user => user.id));

    // Mapear usuarios de ClickUp con información de sincronización
    const clickupUsersWithSyncStatus = uniqueUsers
      .filter(clickupUser => {
        // ✅ Filtrar usuarios válidos
        if (!clickupUser.id) {
          console.warn(`⚠️ Usuario sin ID omitido:`, clickupUser);
          return false;
        }
        if (!clickupUser.username && !clickupUser.email) {
          console.warn(`⚠️ Usuario sin username/email omitido:`, clickupUser.id);
          return false;
        }
        return true;
      })
      .map(clickupUser => {
        const clickupId = clickupUser.id.toString();
        
        return {
          clickupId: clickupId,
          name: clickupUser.username || clickupUser.email || `User-${clickupId}`,
          email: clickupUser.email || '',
          profilePicture: clickupUser.profilePicture || '',
          initials: clickupUser.initials || clickupUser.username?.substring(0, 2).toUpperCase() || 'UK',
          timezone: '', // ✅ CORRECCIÓN: timezone no está disponible en esta API
          // Sin default: si el usuario no tiene color en ClickUp, se deja vacío y
          // la UI genera uno determinista por id (consistente con el kanban). Un
          // default fijo aquí hacía que todos los sin-color salieran iguales.
          color: clickupUser.color || '',
          // ✅ NUEVA INFO: Agregar información adicional de ClickUp
          role: clickupUser.role_key || 'member',
          lastActive: clickupUser.last_active || '',
          dateJoined: clickupUser.date_joined || '',
          // Estado de sincronización
          existsInLocal: localUserIds.has(clickupId),
          canSync: !localUserIds.has(clickupId),
        };
      });

    // Estadísticas
    const existingCount = clickupUsersWithSyncStatus.filter(u => u.existsInLocal).length;
    const newCount = clickupUsersWithSyncStatus.filter(u => u.canSync).length;

    console.log(`📈 Estadísticas de sincronización:`);
    console.log(`   - Ya existen en local: ${existingCount}`);
    console.log(`   - Nuevos por sincronizar: ${newCount}`);

    return NextResponse.json({
      clickupUsers: clickupUsersWithSyncStatus,
      localUsers: localUsers,
      statistics: {
        totalClickUpUsers: uniqueUsers.length,
        existingInLocal: existingCount,
        availableToSync: newCount,
        totalLocalUsers: localUsers.length
      },
      teams: teamsResponse.data.teams.map(team => ({
        id: team.id,
        name: team.name,
        memberCount: team.members.length
      }))
    });

  } catch (error) {
    console.error('❌ Error obteniendo usuarios de ClickUp:', error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.err || error.message;
      
      return NextResponse.json({
        error: 'Error al obtener usuarios de ClickUp',
        details: message,
        status: status
      }, { status: status || 500 });
    }

    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

/**
 * POST /api/sync/clickup-users
 * Sincroniza usuarios seleccionados de ClickUp a la base de datos local
 */
export async function POST(req: Request) {
  if (!CLICKUP_TOKEN) {
    return NextResponse.json({ 
      error: 'CLICKUP_API_TOKEN no configurado' 
    }, { status: 500 });
  }

  try {
    const { userIds }: { userIds: string[] } = await req.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({
        error: 'Se requiere un array de userIds para sincronizar'
      }, { status: 400 });
    }

    // ✅ NUEVA ESTRATEGIA: Usar datos ya obtenidos del endpoint /team
    // En lugar de hacer calls individuales, usamos la data que ya tenemos
    
    console.log(`🔄 Sincronizando ${userIds.length} usuarios usando datos existentes...`);

    // Obtener información actualizada de ClickUp (reutilizar endpoint que funciona)
    const teamsResponse = await axios.get<ClickUpTeamResponse>(
      `${API_CONFIG.CLICKUP_API_BASE}/team`,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    // Crear mapa de usuarios desde los teams
    const allUsers = new Map<string, ClickUpUser>();
    
    teamsResponse.data.teams.forEach(team => {
      team.members.forEach(member => {
        const user = member.user;
        if (user && user.id) {
          const userId = user.id.toString();
          allUsers.set(userId, user);
        }
      });
    });

    // Filtrar solo los usuarios solicitados que existen en ClickUp
    const usersData: ClickUpUser[] = [];
    const notFoundUsers: string[] = [];

    for (const userId of userIds) {
      const userData = allUsers.get(userId);
      if (userData) {
        usersData.push(userData);
        console.log(`   ✅ Datos encontrados para usuario ${userId}: ${userData.username}`);
      } else {
        notFoundUsers.push(userId);
        console.warn(`   ⚠️ Usuario ${userId} no encontrado en teams`);
      }
    }

    if (usersData.length === 0) {
      return NextResponse.json({
        error: 'No se encontró información de ningún usuario en los teams de ClickUp',
        notFoundUsers: notFoundUsers,
        availableUsers: Array.from(allUsers.keys())
      }, { status: 400 });
    }

    console.log(`✅ Datos obtenidos para ${usersData.length} usuarios (${notFoundUsers.length} no encontrados)`);

    // Verificar que los usuarios no existan ya en la DB local
    const existingUsers = await db.query.user.findMany({
      where: inArray(user.id, userIds),
      columns: { id: true, name: true }
    });

    if (existingUsers.length > 0) {
      const existingIds = existingUsers.map(u => u.id);
      console.warn(`⚠️ Usuarios ya existentes omitidos: ${existingIds.join(', ')}`);
    }

    // Filtrar usuarios nuevos
    const existingIds = new Set(existingUsers.map(u => u.id));
    const newUsersData = usersData.filter(user => 
      !existingIds.has(user.id.toString())
    );

    if (newUsersData.length === 0) {
      return NextResponse.json({
        message: 'Todos los usuarios seleccionados ya existen en la base de datos',
        skippedUsers: existingUsers
      });
    }

    // Crear usuarios en la base de datos local
    const createdUsers = [];
    const errors = [];
    
    for (const clickupUser of newUsersData) {
      try {
        // ✅ Validación adicional antes de crear
        if (!clickupUser.id) {
          errors.push(`Usuario sin ID omitido`);
          continue;
        }

        const userId = clickupUser.id.toString();
        const userName = clickupUser.username || clickupUser.email || `User-${userId}`;
        const userEmail = clickupUser.email || '';

        console.log(`   Creando usuario: ${userName} (ID: ${userId})`);

        const [newUser] = await db
          .insert(user)
          .values({
            id: userId,
            name: userName,
            email: userEmail,
            active: true,
            // Los roles se asignarán posteriormente desde la interfaz de administración
          })
          .returning();

        createdUsers.push(newUser);
        console.log(`✅ Usuario creado: ${newUser.name} (${newUser.id})`);

      } catch (createError) {
        const errorMsg = `Error creando usuario ${clickupUser.username || clickupUser.id}: ${createError instanceof Error ? createError.message : 'Error desconocido'}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`🎉 Sincronización completada: ${createdUsers.length} usuarios creados`);
    
    if (errors.length > 0) {
      console.warn(`⚠️ Errores durante la sincronización: ${errors.length}`);
      errors.forEach(error => console.warn(`   - ${error}`));
    }

    if (notFoundUsers.length > 0) {
      console.warn(`⚠️ Usuarios no encontrados en teams: ${notFoundUsers.join(', ')}`);
    }

    return NextResponse.json({
      message: `${createdUsers.length} usuarios sincronizados exitosamente`,
      createdUsers: createdUsers,
      skippedUsers: existingUsers,
      notFoundUsers: notFoundUsers.length > 0 ? notFoundUsers : undefined,
      errors: errors.length > 0 ? errors : undefined,
      statistics: {
        requested: userIds.length,
        foundInTeams: usersData.length,
        notFoundInTeams: notFoundUsers.length,
        alreadyExisting: existingUsers.length,
        created: createdUsers.length,
        errors: errors.length
      }
    });

  } catch (error) {
    console.error('❌ Error en sincronización de usuarios:', error);
    
    return NextResponse.json({
      error: 'Error interno del servidor durante la sincronización',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}