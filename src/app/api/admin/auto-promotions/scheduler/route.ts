import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type AutoPromotion = {
  id: string;
  business_id: string;
  title: string;
  message: string;
  frequency_type: 'hourly' | 'daily' | 'custom';
  frequency_value: number;
  is_active: boolean;
  start_time?: string;
  end_time?: string;
  days_of_week?: string;
  priority: number;
  last_executed?: string;
  business_name?: string;
};

export async function GET() {
  try {
    // Obtener todas las promociones y filtrar activas
    const { data: allPromotions, error } = await supabase
      .from('auto_promotions')
      .select('*')
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching promotions:', error);
      return NextResponse.json({ error: 'Error al obtener promociones' }, { status: 500 });
    }

    const promotions = allPromotions?.filter(p => p.is_active === true || p.is_active === 'true') || [];

    console.log(`🔍 Found ${promotions.length} active promotions`);

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentDay = now.getDay(); // 0 = domingo, 1 = lunes, etc.
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;

    const promotionsToExecute: AutoPromotion[] = [];

    for (const promo of promotions || []) {
      const promotion: AutoPromotion = {
        ...promo,
        business_name: promo.business_name || 'Sin nombre'
      };

      console.log(`\n🔍 Checking promotion: ${promotion.title}`);
      console.log(`   Active: ${promotion.is_active}`);
      console.log(`   Last executed: ${promotion.last_executed}`);

      // Verificar si debe ejecutarse según horario
      const timeCheck = shouldExecuteByTime(promotion, currentTime);
      console.log(`   ⏰ Time check: ${timeCheck ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`      Current: ${currentTime}, Range: ${promotion.start_time} - ${promotion.end_time}`);
      if (!timeCheck) {
        console.log(`   ⛔ SKIPPED: No pasa verificación de horario`);
        continue;
      }

      // Verificar si debe ejecutarse según días de la semana
      const dayCheck = shouldExecuteByDay(promotion, currentDay);
      console.log(`   📅 Day check: ${dayCheck ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`      Current day: ${currentDay}, Allowed: ${promotion.days_of_week}`);
      if (!dayCheck) {
        console.log(`   ⛔ SKIPPED: No pasa verificación de día`);
        continue;
      }

      // Verificar si debe ejecutarse según frecuencia
      const freqCheck = shouldExecuteByFrequency(promotion, now);
      console.log(`   🔄 Frequency check: ${freqCheck ? '✅ PASS' : '❌ FAIL'}`);
      if (freqCheck) {
        console.log(`   ✅ PROMOCIÓN APROBADA para ejecución`);
        promotionsToExecute.push(promotion);
      } else {
        console.log(`   ⛔ SKIPPED: No pasa verificación de frecuencia`);
      }
    }

    // Ordenar por prioridad (mayor prioridad primero)
    promotionsToExecute.sort((a, b) => b.priority - a.priority);

    // Actualizar last_executed para las promociones que se ejecutarán
    for (const promo of promotionsToExecute) {
      await supabase
        .from('auto_promotions')
        .update({ last_executed: now.toISOString() })
        .eq('id', promo.id);
    }

    return NextResponse.json({
      success: true,
      count: promotionsToExecute.length,
      promotions: promotionsToExecute,
      current_time: currentTime,
      current_day: currentDay,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('Error en scheduler:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

function shouldExecuteByTime(promotion: AutoPromotion, currentTime: string): boolean {
  // Si no hay restricción de horario, ejecutar siempre
  if (!promotion.start_time || !promotion.end_time) {
    return true;
  }

  const current = convertTimeToMinutes(currentTime);
  const start = convertTimeToMinutes(promotion.start_time);
  const end = convertTimeToMinutes(promotion.end_time);

  return current >= start && current <= end;
}

function shouldExecuteByDay(promotion: AutoPromotion, currentDay: number): boolean {
  // Si no hay restricción de días, ejecutar siempre
  if (!promotion.days_of_week) {
    console.log(`      No days restriction, allowing all days`);
    return true;
  }

  try {
    // Limpiar el string de escapes extras
    let cleanDays = promotion.days_of_week;
    
    // Si empieza con comillas dobles, removerlas
    if (cleanDays.startsWith('"') && cleanDays.endsWith('"')) {
      cleanDays = cleanDays.slice(1, -1);
    }
    
    // Reemplazar escapes de comillas
    cleanDays = cleanDays.replace(/\\"/g, '"');
    
    console.log(`      Parsing days_of_week: ${cleanDays}`);
    const allowedDays = JSON.parse(cleanDays);
    
    if (!Array.isArray(allowedDays) || allowedDays.length === 0) {
      console.log(`      Empty or invalid days array, allowing all days`);
      return true; // Si está vacío o mal formateado, ejecutar siempre
    }
    
    const result = allowedDays.includes(currentDay.toString());
    console.log(`      Allowed days: ${allowedDays.join(', ')}, Current: ${currentDay}, Match: ${result}`);
    return result;
  } catch (error) {
    console.log(`      Error parsing days: ${error}, allowing all days`);
    return true; // Si no se puede parsear, ejecutar siempre
  }
}

function shouldExecuteByFrequency(promotion: AutoPromotion, now: Date): boolean {
  if (!promotion.last_executed) {
    console.log(`      First execution, allowing`);
    return true; // Primera vez, ejecutar
  }

  const lastExecuted = new Date(promotion.last_executed);
  const timeDiff = now.getTime() - lastExecuted.getTime();
  const minutesPassed = Math.floor(timeDiff / 1000 / 60);

  switch (promotion.frequency_type) {
    case 'hourly':
      // frequency_value = veces por hora
      // Calcular intervalo: 60 minutos / veces por hora
      const hourlyInterval = (60 / promotion.frequency_value) * 60 * 1000; // en milisegundos
      const hourlyMinutes = Math.floor(hourlyInterval / 1000 / 60);
      const hourlyPass = timeDiff >= hourlyInterval;
      console.log(`      Hourly: ${promotion.frequency_value}x/hora = cada ${hourlyMinutes} min. Pasaron ${minutesPassed} min. ${hourlyPass ? '✅' : '❌'}`);
      return hourlyPass;

    case 'daily':
      // frequency_value = veces por día
      // Calcular intervalo: 24 horas / veces por día
      const dailyInterval = (24 * 60 / promotion.frequency_value) * 60 * 1000; // en milisegundos
      const dailyMinutes = Math.floor(dailyInterval / 1000 / 60);
      const dailyPass = timeDiff >= dailyInterval;
      console.log(`      Daily: ${promotion.frequency_value}x/día = cada ${dailyMinutes} min. Pasaron ${minutesPassed} min. ${dailyPass ? '✅' : '❌'}`);
      return dailyPass;

    case 'custom':
      // frequency_value = cada cuántos minutos
      const customInterval = promotion.frequency_value * 60 * 1000; // en milisegundos
      const customPass = timeDiff >= customInterval;
      console.log(`      Custom: cada ${promotion.frequency_value} min. Pasaron ${minutesPassed} min. ${customPass ? '✅' : '❌'}`);
      return customPass;

    default:
      console.log(`      Unknown frequency type: ${promotion.frequency_type}`);
      return false;
  }
}

function convertTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}