import { NextRequest, NextResponse } from 'next/server';
import mercadopago from 'mercadopago';
import { supabase } from '@/lib/supabase';

// Mercado Pago types and client wrapper
interface PreferencePayload {
  items: { title: string; description?: string; quantity: number; currency_id: string; unit_price: number }[];
  payer: { email: string };
  back_urls: { success: string; failure: string; pending: string };
  auto_return: string;
  external_reference: string;
  notification_url: string;
}

interface PreferenceResponse {
  id?: string;
  init_point?: string;
  [key: string]: unknown;
}

interface PaymentDetails {
  status?: string;
  external_reference?: string;
  id?: string | number;
  [key: string]: unknown;
}

interface MercadoPagoClient {
  configure?: (opts: { access_token: string }) => void;
  setAccessToken?: (token: string) => void;
  preferences: { create: (payload: PreferencePayload) => Promise<PreferenceResponse | { body?: PreferenceResponse }>; };
  payment: { get: (id: string | number) => Promise<PaymentDetails | { body?: PaymentDetails }>; };
}

const rawMpModule = mercadopago as unknown as { default?: unknown; configure?: unknown; setAccessToken?: unknown };
const mpClientBase = (() => {
  const m = rawMpModule as { default?: unknown; configure?: unknown } | undefined;
  if (m && typeof m.configure === 'function') return m;
  if (m && m.default && typeof (m.default as { configure?: unknown }).configure === 'function') return m.default;
  return m;
})();
const mp = mpClientBase as unknown as MercadoPagoClient;
try {
  if (typeof mp.configure === 'function') {
    mp.configure({ access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN || '' });
  } else if (typeof mp.setAccessToken === 'function') {
    mp.setAccessToken(process.env.MERCADO_PAGO_ACCESS_TOKEN || '');
  } else {
    console.warn('Mercado Pago SDK configure not available; ensure ACCESS TOKEN is set in ENV or SDK supports configuration in this environment.');
  }
} catch (e) {
  console.warn('Mercado Pago configure call failed:', e);
}


export async function POST(request: NextRequest) {
  try {
    const { businessId, planName, amount, period, businessName, businessEmail } = await request.json();

    if (!businessId || !planName || !amount || !businessName || !businessEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

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

    const response = await mp.preferences.create(preferencePayload);

    const prefVals = (() => {
      if (!response) return { id: null as string | null, init_point: null as string | null };
      if ('body' in response && response.body) {
        const b = response.body as PreferenceResponse;
        return { id: b.id ?? null, init_point: b.init_point ?? null };
      } else {
        const r = response as PreferenceResponse;
        return { id: r.id ?? null, init_point: r.init_point ?? null };
      }
    })();

    // Save payment record in database
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        business_id: businessId,
        amount: amount,
        payment_method: 'mercadopago',
        mercadopago_id: prefVals.id,
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
      preferenceId: prefVals.id,
      initPoint: prefVals.init_point,
      paymentId: payment?.id,
    });

  } catch (error) {
    console.error('Error creating Mercado Pago preference:', error);
    return NextResponse.json(
      { error: 'Failed to create payment preference' },
      { status: 500 }
    );
  }
}

// Webhook para recibir notificaciones de Mercado Pago
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Verificar que sea una notificación válida de Mercado Pago
    if (body.action === 'payment.updated') {
      const paymentId = body.data.id;

      // Obtener detalles del pago desde Mercado Pago
      const mpPaymentResponse = await mp.payment.get(paymentId);
      const paymentDetails: PaymentDetails = (mpPaymentResponse && 'body' in mpPaymentResponse && mpPaymentResponse.body) ? (mpPaymentResponse.body as PaymentDetails) : (mpPaymentResponse as PaymentDetails);

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
      }
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}