-- Seed data for Meta WhatsApp API demo environment
-- Run after applying migrations

BEGIN;

INSERT INTO empresas (id, nombre, estado, webhook_secret, meta_app_id, meta_access_token, meta_webhook_verify_token, created_at, updated_at)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Sandbox Meta Demo',
    'activa',
    'sandbox-secret',
    '238947515083716',
    'EAAQ5VhZB8sb4BQCfpXxusmQDrTigbm5R8LrSsRDepFtCOH9Q4dNuyF7vY9nAiG9cnP0ynpI4ZCjPDgleLkZBPl5CoVe97hS6jZA8zu1Aimv31TGzXxArwHz4o5lEeSzLK2LaPegfhZBWzZAiH0HAmUFduOoSZAkvzWQHFWAqOEwiJe7PSEytcUIseLT7xnGyImSi6sCEDZC5ofhO2z1KbcuoaI9zQMKC16jcA0HojMs8DCQ7tIO42PdPFLruFYhcILHHM5DDp7F2lrJaVglfp0jS',
    'sandbox_verify_token',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO celulares (id, empresa_id, alias, phone_number, meta_phone_number_id, waba_id, estado, estado_desde, limite_mensual, ultimo_token_valido, created_at)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'Meta Test Number',
    '+15551676015',
    '891207920743299',
    '114815674123456',
    'activo',
    NOW(),
    10000,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO contactos (id, empresa_id, nombre, telefono, pais, extra_data, created_at, updated_at)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'Hello World Contact',
    '+541156384310',
    'AR',
    '{"source":"meta-docs","notes":"Contacto usado en el ejemplo oficial hello_world."}'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO conversaciones (id, empresa_id, contacto_id, celular_id, canal, estado, contexto_meta, opened_at, closed_at)
VALUES (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    'whatsapp',
    'activa',
    '{"conversation_id":"f7f26c90b947c1a4145633bf9b0a3a92","category":"utility","expiration":"2030-01-01T00:00:00Z"}'::jsonb,
    NOW(),
    NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO mensajes (id, conversacion_id, empresa_id, celular_id, contacto_id, meta_message_id, direccion, tipo, contenido, status, error_code, meta_payload, created_at, sent_at, delivered_at, read_at)
VALUES (
    '55555555-5555-5555-5555-555555555555',
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    'wamid.HBgMNTQxMTU2Mzg0MzEwFQIAEhggQTY2RDI1QkI0NzczQkU4NTk4QQA=',
    'out',
    'template',
    '{"messaging_product":"whatsapp","to":"+541156384310","template":{"name":"hello_world","language":{"code":"en_US"}}}'::jsonb,
    'sent',
    NULL,
    '{"messaging_product":"whatsapp","contacts":[{"input":"+541156384310","wa_id":"541156384310"}],"messages":[{"id":"wamid.HBgMNTQxMTU2Mzg0MzEwFQIAEhggQTY2RDI1QkI0NzczQkU4NTk4QQA="}]}'::jsonb,
    NOW(),
    NOW(),
    NOW(),
    NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO webhook_eventos (id, empresa_id, tipo_evento, meta_entry_id, raw_payload, procesado, created_at, processed_at)
VALUES (
    '66666666-6666-6666-6666-666666666666',
    '11111111-1111-1111-1111-111111111111',
    'message-status',
    'WHATSAPP-BUSINESS-ACCOUNT-ID',
    '{"object":"whatsapp_business_account","entry":[{"id":"WHATSAPP-BUSINESS-ACCOUNT-ID","changes":[{"field":"messages","value":{"messaging_product":"whatsapp","statuses":[{"id":"wamid.HBgMNTQxMTU2Mzg0MzEwFQIAEhggQTY2RDI1QkI0NzczQkU4NTk4QQA=","status":"delivered"}]}}]}]}'::jsonb,
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO plantillas_meta (id, empresa_id, nombre, categoria, idioma, estado_meta, variables, ultima_revision, created_at)
VALUES (
    '77777777-7777-7777-7777-777777777777',
    '11111111-1111-1111-1111-111111111111',
    'hello_world',
    'utility',
    'en_US',
    'APPROVED',
    '{"placeholders":1}'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO logs_integracion (id, empresa_id, celular_id, scope, intent, request_payload, response_payload, status_code, resultado, created_at)
VALUES (
    '88888888-8888-8888-8888-888888888888',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'send',
    'hello_world_template',
    '{"url":"https://graph.facebook.com/v22.0/891207920743299/messages","body":{"messaging_product":"whatsapp","to":"+541156384310","type":"template","template":{"name":"hello_world","language":{"code":"en_US"}}}, "headers":{"Authorization":"Bearer EAAQ5VhZB8sb4...0jS","Content-Type":"application/json"}}'::jsonb,
    '{"status":200,"body":{"messaging_product":"whatsapp","contacts":[{"input":"+541156384310","wa_id":"541156384310"}],"messages":[{"id":"wamid.HBgMNTQxMTU2Mzg0MzEwFQIAEhggQTY2RDI1QkI0NzczQkU4NTk4QQA="}]}}'::jsonb,
    200,
    'ok',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
