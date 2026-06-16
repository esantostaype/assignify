import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

// Settings predefinidos con sus valores por defecto
const DEFAULT_SETTINGS = [
  // Work Schedule
  {
    category: 'work_schedule',
    key: 'start_hour',
    value: 8,
    dataType: 'number',
    label: 'Work Start Hour',
    description: 'Hour when work day starts (24h format)',
    group: 'work_schedule',
    order: 1,
    minValue: 0,
    maxValue: 23,
    required: true
  },
  {
    category: 'work_schedule',
    key: 'end_hour',
    value: 18,
    dataType: 'number',
    label: 'Work End Hour',
    description: 'Hour when work day ends (24h format)',
    group: 'work_schedule',
    order: 2,
    minValue: 0,
    maxValue: 23,
    required: true
  },
  {
    category: 'work_schedule',
    key: 'lunch_start',
    value: 13,
    dataType: 'number',
    label: 'Lunch Start Hour',
    description: 'Hour when lunch break starts',
    group: 'work_schedule',
    order: 3,
    minValue: 0,
    maxValue: 23,
    required: true
  },
  {
    category: 'work_schedule',
    key: 'lunch_duration',
    value: 1,
    dataType: 'number',
    label: 'Lunch Duration (hours)',
    description: 'Duration of lunch break in hours',
    group: 'work_schedule',
    order: 4,
    minValue: 0.5,
    maxValue: 2,
    required: true
  },
  // Task Assignment
  {
    category: 'task_assignment',
    key: 'normal_before_low_threshold',
    value: 2,
    dataType: 'number',
    label: 'Normal Tasks Before Low',
    description: 'Number of NORMAL priority tasks before placing a LOW priority task',
    group: 'task_assignment',
    order: 1,
    minValue: 1,
    maxValue: 10,
    required: true
  },
  {
    category: 'task_assignment',
    key: 'consecutive_low_threshold',
    value: 3,
    dataType: 'number',
    label: 'Consecutive Low Tasks Threshold',
    description: 'Maximum consecutive LOW priority tasks before forcing interleaving',
    group: 'task_assignment',
    order: 2,
    minValue: 1,
    maxValue: 10,
    required: true
  },
  {
    category: 'task_assignment',
    key: 'deadline_difference_threshold',
    value: 30,
    dataType: 'number',
    label: 'Deadline Difference Threshold (days)',
    description: 'Days difference to prefer generalist over specialist',
    group: 'task_assignment',
    order: 3,
    minValue: 5,
    maxValue: 60,
    required: true
  },
  // Tier Settings (nota informativa)
  {
    category: 'tier_settings',
    key: 'tier_info',
    value: 'Tier durations are managed in the table below',
    dataType: 'string',
    label: 'Tier Duration Management',
    description: 'Use the table below to adjust tier durations',
    group: 'tier_settings',
    order: 1,
    required: false
  }
];

// GET /api/settings
export async function GET() {
  try {
    // Obtener settings de la base de datos
    let settings = await prisma.systemSettings.findMany({
      orderBy: [
        { group: 'asc' },
        { order: 'asc' }
      ]
    });

    // Si no hay settings, crear los por defecto
    if (settings.length === 0) {
      console.log('🔄 Creating default settings...');
      
      for (const defaultSetting of DEFAULT_SETTINGS) {
        await prisma.systemSettings.create({
          data: defaultSetting
        });
      }
      
      settings = await prisma.systemSettings.findMany({
        orderBy: [
          { group: 'asc' },
          { order: 'asc' }
        ]
      });
    }

    return NextResponse.json({
      settings,
      count: settings.length
    });

  } catch (error) {
    console.error('❌ Error fetching settings:', error);
    return NextResponse.json({
      error: 'Error fetching settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PATCH /api/settings
export async function PATCH(req: Request) {
  try {
    const { updates } = await req.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({
        error: 'Invalid updates array'
      }, { status: 400 });
    }

    const results = [];

    for (const update of updates) {
      const { category, key, value } = update;

      if (!category || !key || value === undefined) {
        continue;
      }

      const updated = await prisma.systemSettings.updateMany({
        where: {
          category,
          key
        },
        data: {
          value: value
        }
      });

      results.push({
        category,
        key,
        updated: updated.count > 0
      });
    }

    console.log(`✅ Updated ${results.length} settings`);

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('❌ Error updating settings:', error);
    return NextResponse.json({
      error: 'Error updating settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}