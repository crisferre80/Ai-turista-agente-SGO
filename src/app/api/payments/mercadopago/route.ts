import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  let webhookId = null;

  try {
    const body = await request.json();

    // Verificar si es un webhook de Mercado Pago (tiene campo 'action')
    if (body.action === 'payment.updated') {
      webhookId = body.id || `webhook_${Date.now()}_${Math.random()}`;

      // Verificar si este webhook ya fue procesado
      const { data: existingWebhook } = await supabase
        .from('webhooks')
        .select('processed, processing_attempts')
        .eq('webhook_id', webhookId)
        .single();

      if (existingWebhook?.processed) {
        console.log('Webhook already processed:', webhookId);
        return NextResponse.json({ received: true });
      }

      // Registrar el webhook en la base de datos
      const { error: webhookError } = await supabase
        .from('webhooks')
        .insert({
          webhook_id: webhookId,
          type: body.type,
          action: body.action,
          payment_id: body.data?.id,
          data: body,
          processing_attempts: (existingWebhook?.processing_attempts || 0) + 1,
          last_attempt_at: new Date().toISOString()
        });

      if (webhookError) {
        console.error('Error saving webhook:', webhookError);
      }

      // Procesar webhook
      const paymentId = body.data.id;

      // Obtener detalles del pago desde Mercado Pago usando fetch directo
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`
        }
      });

      if (!paymentResponse.ok) {
        console.error('Error fetching payment details:', paymentResponse.status);
        return NextResponse.json({ error: 'Failed to fetch payment details' }, { status: 500 });
      }

      const paymentDetails = await paymentResponse.json();

      if (paymentDetails.status === 'approved') {
        // Actualizar el pago en la base de datos
        const externalReference = paymentDetails.external_reference || '';
        const [type, businessId, planName, period] = (externalReference || '').split('_');

        if (type === 'business') {
          // Calcular fecha de fin de suscripción
          const now = new Date();
          const endDate = new Date(now);
          if (period === 'yearly') {
            endDate.setFullYear(now.getFullYear() + 1);
          } else {
            endDate.setMonth(now.getMonth() + 1);
          }

          // Actualizar negocio
          await supabase
            .from('businesses')
            .update({
              plan: planName,
              is_active: true,
              payment_status: 'paid',
              subscription_end: endDate.toISOString().split('T')[0],
            })
            .eq('id', businessId);

          // Actualizar pago
          await supabase
            .from('payments')
            .update({
              status: 'approved',
              mercadopago_id: paymentId.toString(),
            })
            .eq('business_id', businessId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1);
        }

        // Marcar webhook como procesado exitosamente
        await supabase
          .from('webhooks')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
            error_message: null
          })
          .eq('webhook_id', webhookId);
      }

      return NextResponse.json({ received: true });
    }

    // Si no es webhook, procesar como creación de preferencia de pago
    const { businessId, planName, amount, period, businessName, businessEmail } = body;

    console.log('MercadoPago API called with:', { businessId, planName, amount, period, businessName, businessEmail });

    if (!businessId || !planName || !amount || !businessName || !businessEmail) {
      console.error('Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verificar que el access token esté configurado
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('MERCADO_PAGO_ACCESS_TOKEN not configured');
      return NextResponse.json(
        { error: 'Payment service not configured' },
        { status: 500 }
      );
    }

    console.log('Creating MercadoPago preference...');

    const preferencePayload = {
      items: [
        {
          title: `Plan ${planName.charAt(0).toUpperCase() + planName.slice(1)} - ${businessName}`,
          description: `Suscripción ${period === 'monthly' ? 'mensual' : 'anual'} para negocio en Tourist Assistant`,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: amount,
        },
      ],
      payer: {
        email: businessEmail,
      },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL}/business/profile?payment=success`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL}/business/profile?payment=failure`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL}/business/profile?payment=pending`,
      },
      auto_return: 'approved',
      external_reference: `business_${businessId}_${planName}_${period}_${Date.now()}`,
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/mercadopago/webhook`,
    };

    console.log('Preference payload:', preferencePayload);

    // Usar fetch directo en lugar del SDK problemático
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(preferencePayload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('MercadoPago API error:', response.status, data);
      return NextResponse.json(
        { error: 'Failed to create payment preference', details: data },
        { status: response.status }
      );
    }

    console.log('MercadoPago response:', data);

    // Extraer los valores de la respuesta
    const preferenceId = data.id;
    const initPoint = data.init_point;

    // Save payment record in database
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        business_id: businessId,
        amount: amount,
        payment_method: 'mercadopago',
        mercadopago_id: preferenceId,
        status: 'pending',
        plan_name: planName,
        period: period,
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error saving payment:', paymentError);
    }

    return NextResponse.json({
      preferenceId: preferenceId,
      initPoint: initPoint,
      paymentId: payment?.id,
    });

  } catch (error) {
    console.error('Error processing Mercado Pago webhook/payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Si fue un error en el procesamiento de webhook, marcar como fallido
    if (webhookId) {
      await supabase
        .from('webhooks')
        .update({
          error_message: errorMessage,
          last_attempt_at: new Date().toISOString()
        })
        .eq('webhook_id', webhookId);
    }

    console.error('Error details:', error);
    return NextResponse.json(
      { error: 'Failed to process payment', details: errorMessage },
      { status: 500 }
    );
  }
}