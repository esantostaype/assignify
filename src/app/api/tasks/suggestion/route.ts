// src/app/api/tasks/suggestion/route.ts - VERSIÓN FINAL CON LÓGICA DE VACACIONES

import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { Priority } from '@prisma/client';
import { getBestUserWithCache } from '@/services/task-assignment.service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');
    const tierId = parseInt(searchParams.get('tierId') || '0');
    const typeId = parseInt(searchParams.get('typeId') || '0');
    const priority = searchParams.get('priority') as Priority;

    if (!brandId || !tierId || !typeId || !priority) {
      return NextResponse.json({
        error: 'Faltan parámetros requeridos',
        required: ['brandId', 'tierId', 'typeId', 'priority'],
        received: {
          brandId: brandId || 'missing',
          tierId: tierId || 'missing',
          typeId: typeId || 'missing',
          priority: priority || 'missing'
        }
      }, { status: 400 });
    }

    const validPriorities: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json({ 
        error: 'Prioridad inválida',
        validPriorities,
        received: priority
      }, { status: 400 });
    }

    console.log(`🔍 === GENERANDO SUGERENCIA CON LÓGICA DE VACACIONES ===`);
    console.log(`📋 Parámetros de entrada:`);
    console.log(`   - Brand ID: ${brandId}`);
    console.log(`   - Tier ID: ${tierId}`);
    console.log(`   - Type ID: ${typeId}`);
    console.log(`   - Priority: ${priority}`);

    const [tier, type] = await Promise.all([
      prisma.tierList.findUnique({
        where: { id: tierId }
      }),
      prisma.taskType.findUnique({
        where: { id: typeId }
      })
    ]);

    if (!tier) {
      return NextResponse.json({
        error: 'Tier no encontrado',
        tierId: tierId
      }, { status: 404 });
    }

    if (!type) {
      return NextResponse.json({
        error: 'Tipo no encontrado',
        typeId: typeId
      }, { status: 404 });
    }

    console.log(`✅ Tier encontrado:`);
    console.log(`   - Tipo: ${type.name}`);
    console.log(`   - Duración: ${tier.duration} días`); // Desde tier
    console.log(`   - Tier: ${tier.name}`); // Desde tier

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, name: true, isActive: true }
    });

    if (!brand) {
      return NextResponse.json({ 
        error: 'Brand no encontrado',
        brandId: brandId
      }, { status: 404 });
    }

    if (!brand.isActive) {
      return NextResponse.json({ 
        error: 'Brand no está activo',
        brandId: brandId,
        brandName: brand.name
      }, { status: 400 });
    }

    console.log(`✅ Brand encontrado: ${brand.name} (activo)`);
    console.log(`🤖 Buscando mejor usuario con lógica de vacaciones...`);
    
    const bestSlot = await getBestUserWithCache(
      type.id,
      brandId,
      priority,
      tier.duration // Usar duration desde tier
    );

    if (!bestSlot) {
      console.log('❌ No se encontró diseñador óptimo para la sugerencia');
      
      const compatibleUsersCount = await prisma.user.count({
        where: {
          active: true,
          roles: {
            some: {
              typeId: type.id,
              OR: [
                { brandId: brandId },
                { brandId: null }
              ]
            }
          }
        }
      });

      return NextResponse.json({
        error: 'No se pudo encontrar un diseñador óptimo para la asignación automática',
        details: 'No hay usuarios disponibles que cumplan con los criterios de asignación considerando vacaciones y carga de trabajo',
        diagnostics: {
          compatibleUsersTotal: compatibleUsersCount,
          typeRequired: type.name,
          brandId: brandId,
          priority: priority
        }
      }, { status: 400 });
    }

    const estimatedDurationHours = tier.duration * 8; // Desde tier
    const estimatedDurationDays = tier.duration; // Desde tier

    const estimatedEndDate = new Date(bestSlot.availableDate);
    estimatedEndDate.setDate(estimatedEndDate.getDate() + Math.ceil(estimatedDurationDays));

    console.log(`✅ Sugerencia generada exitosamente:`);
    console.log(`   👤 Usuario sugerido: ${bestSlot.userName} (ID: ${bestSlot.userId})`);
    console.log(`   📊 Carga actual: ${bestSlot.cargaTotal} tareas`);
    console.log(`   📅 Disponible desde: ${bestSlot.availableDate.toISOString()}`);
    console.log(`   🎯 Es especialista: ${bestSlot.isSpecialist ? 'Sí' : 'No'}`);
    console.log(`   ⏰ Duración estimada: ${estimatedDurationHours} horas (${estimatedDurationDays} días)`);
    console.log(`   📆 Fecha estimada de fin: ${estimatedEndDate.toISOString()}`);

    return NextResponse.json({
      suggestedUserId: bestSlot.userId,
      estimatedDurationHours: estimatedDurationHours,
      
      suggestion: {
        userId: bestSlot.userId,
        estimatedDurationHours: estimatedDurationHours,
        estimatedDurationDays: estimatedDurationDays
      },
      
      userInfo: {
        id: bestSlot.userId,
        name: bestSlot.userName,
        currentLoad: bestSlot.cargaTotal,
        isSpecialist: bestSlot.isSpecialist,
        availableFrom: bestSlot.availableDate.toISOString(),
        estimatedStartDate: bestSlot.availableDate.toISOString(),
        estimatedEndDate: estimatedEndDate.toISOString(),
        lastTaskDeadline: bestSlot.lastTaskDeadline?.toISOString() || null
      },
      
      tierInfo: {
        id: tier.id,
        name: tier.name,
        duration: tier.duration, // Desde tier
        type: {
          id: type.id,
          name: type.name
        }
      },
      
      brandInfo: {
        id: brand.id,
        name: brand.name,
        isActive: brand.isActive
      },
      
      metadata: {
        priority: priority,
        generatedAt: new Date().toISOString(),
        consideresVacations: true,
        considersHolidays: true,
        considersWorkload: true,
        algorithm: 'vacation-aware-assignment'
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener sugerencia:', error);
    
    if (error instanceof Error) {
      console.error(`   - Message: ${error.message}`);
      console.error(`   - Stack: ${error.stack}`);
    }

    return NextResponse.json({
      error: 'Error interno del servidor al obtener sugerencia',
      details: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}