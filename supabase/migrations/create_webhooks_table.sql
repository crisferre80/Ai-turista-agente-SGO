-- TABLA PARA REGISTRAR WEBHOOKS DE MERCADO PAGO
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id TEXT UNIQUE NOT NULL, -- ID único del webhook de MP
  type TEXT NOT NULL, -- 'payment.updated', etc.
  action TEXT, -- 'payment.updated'
  payment_id TEXT, -- ID del pago en MP
  data JSONB, -- Datos completos del webhook
  processed BOOLEAN DEFAULT FALSE, -- Si fue procesado exitosamente
  processing_attempts INTEGER DEFAULT 0, -- Número de intentos de procesamiento
  last_attempt_at TIMESTAMP WITH TIME ZONE, -- Último intento
  error_message TEXT, -- Mensaje de error si falló
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE -- Cuando se procesó exitosamente
);

-- ÍNDICE PARA BÚSQUEDA RÁPIDA POR WEBHOOK_ID
CREATE INDEX IF NOT EXISTS idx_webhooks_webhook_id ON webhooks(webhook_id);

-- ÍNDICE PARA PAGOS PENDIENTES
CREATE INDEX IF NOT EXISTS idx_webhooks_processed ON webhooks(processed) WHERE processed = FALSE;