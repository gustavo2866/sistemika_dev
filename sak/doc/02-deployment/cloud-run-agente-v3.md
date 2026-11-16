# Cloud Run: CPU y escalado del agente v3

## Por qué importa la facturación

El webhook de Meta responde después de encolar el mensaje y ejecuta `process_pending_once_v3` mediante `BackgroundTasks` (`backend/app/routers/channel_meta_webhook_router.py`). Esa tarea procesa el inbox, llama al LLM cuando corresponde y envía la respuesta por el outbox. Por lo tanto, el agente necesita CPU **después** de que Cloud Run entrega la respuesta HTTP al webhook.

En la consola de Cloud Run, **Facturación basada en solicitudes** equivale a `cpu-throttling=true`: la CPU se limita fuera de las solicitudes. **Facturación basada en instancias** equivale a `cpu-throttling=false`: la instancia dispone de CPU durante toda su vida. Para el flujo actual del agente v3 se requiere la segunda opción. Para usar facturación basada en solicitudes habría que completar el procesamiento dentro de la solicitud HTTP o trasladarlo a un mecanismo que reciba su propia solicitud, como Cloud Tasks.

Referencias: [facturación y asignación de CPU](https://docs.cloud.google.com/run/docs/configuring/billing-settings), [trabajo en segundo plano](https://docs.cloud.google.com/run/docs/tips/general).

## Configuración por ambiente

| Ambiente | Servicio actual | CPU fuera de solicitudes | Mínimo a nivel servicio | Mínimo a nivel revisión |
| --- | --- | --- | --- | --- |
| Test | `sak-backend-test` | Sí (`--no-cpu-throttling`) | 0 | 0 |
| Producción | `sak-backend` | Sí (`--no-cpu-throttling`) | 0 por defecto | 1 en la revisión actual |

El mínimo 0 de test permite escalar a cero cuando no hay actividad. No equivale a facturación basada en solicitudes: con facturación basada en instancias se cobra durante toda la vida de cada instancia, incluso mientras permanece inactiva antes de apagarse. También puede haber un arranque en frío en el primer mensaje. Un mínimo de revisión igual a 1 mantiene una instancia activa aunque el mínimo del servicio sea 0; al combinar ambos niveles prevalece el mayor. Ver [instancias mínimas](https://docs.cloud.google.com/run/docs/configuring/min-instances).

Para replicar la configuración de test en otro servicio, reemplazar proyecto, región y nombre:

```bash
gcloud run services update SERVICE --project=PROJECT_ID --region=REGION --no-cpu-throttling --min=0 --min-instances=0
```

`--min=0` establece el mínimo del **servicio**. `--min-instances=0` establece el de la **nueva revisión**; modificarlo despliega una revisión nueva. Si un ambiente necesita una instancia caliente, elegir explícitamente otro mínimo y asumir su costo. No cambiar el mínimo de producción por copiar la configuración de test.

En la consola: abrir el servicio, ir a **Escalamiento**, seleccionar **Facturación basada en instancias** y revisar el mínimo tanto del servicio como de la revisión. Aplicar los cambios y verificar la revisión que sirve tráfico; una selección visible antes de desplegar no confirma la configuración efectiva.

## Despliegues y verificación

En el repo, mantener `--no-cpu-throttling` y el mínimo deseado en **todos** los caminos de despliegue del ambiente. Para test son `backend/scripts/deploy-gcp-test.ps1`, `cmd/deploy_gcp_test.ps1` y `.github/workflows/deploy-gcp-test.yml` (este último está en la raíz del repositorio padre de `sak`); los tres fijan `--min=0` y `--min-instances=0`. Si un deploy omite estos valores o conserva `--min-instances=1`, puede deshacer el ajuste o volver a dejar una instancia permanente. El workflow de producción `.github/workflows/deploy-gcp.yml` conserva mínimo 1 y no declara explícitamente el modo de CPU; al replicar el flujo en otro ambiente, agregar `--no-cpu-throttling` al deploy en vez de depender del valor heredado.

Después de desplegar:

1. Ejecutar `gcloud run services describe SERVICE --project=PROJECT_ID --region=REGION --format=yaml` y verificar en la revisión activa `run.googleapis.com/cpu-throttling: 'false'`, los mínimos deseados y el tráfico hacia esa revisión. La ausencia de una anotación de mínimo significa el valor predeterminado 0.
2. Comprobar que `/health` responde 200. Este endpoint solo verifica el servicio; no llama al LLM ni a Meta.
3. Enviar un mensaje real que requiera interpretación LLM y revisar en Cloud Logging `v3_meta_receive_timing` (`received_count=1`), `v3_runtime_timing` y `v3_outbox_timing` (`status=sent`). Revisar que no aparezcan `ConnectTimeout` ni reintentos de OpenAI.

El historial de revisiones de test aclara la diferencia entre lo que mostraba la consola y la configuración efectiva:

| Revisión | Origen | Facturación / CPU | Mínimo de revisión |
| --- | --- | --- | --- |
| `sak-backend-test-00097-fnk` | `gcloud`, anterior al cambio | Basada en instancias (`cpu-throttling=false`) | 1 |
| `sak-backend-test-00098-7sz` | Consola de GCP, cambio manual de facturación | Basada en solicitudes (`cpu-throttling=true`) | 1 |
| `sak-backend-test-00099-gtt` | `gcloud`, corrección del 10/11/2026 | Basada en instancias (`cpu-throttling=false`) | 0 |

El cambio `00097` → `00098` se hizo **directamente en la consola de GCP**, sin un deploy de GitHub. Solo se cambió la modalidad de facturación; la imagen, CPU, memoria, concurrencia y mínimo de revisión se mantuvieron. La pantalla mostraba mínimo 0 **a nivel servicio**, que no anulaba el mínimo 1 de la revisión. Con `00099` se restauró la CPU fuera de solicitudes **y** se quitó el mínimo de revisión; el mínimo del servicio sigue en 0. Esta es la diferencia de costo fijo frente a la configuración original. La nueva revisión conserva la misma imagen que `00098`. Los scripts y el workflow de test se ajustaron **después** para preservar esta configuración en futuros despliegues; no fueron el origen del cambio manual.

En `00098` hubo turnos de Parte Diario de 40 a 58 segundos con `ConnectTimeout` durante la conexión HTTPS a OpenAI. La prueba posterior del saludo en `00099` confirmó recepción y procesamiento del webhook; la respuesta a Meta requirió además actualizar el token de Meta. **Esa prueba de saludo no ejercitó el LLM**, por lo que la validación de latencia del LLM debe hacerse con un mensaje que sí lo invoque.

Si el webhook se recibe y el agente procesa el mensaje pero `v3_outbox_timing` indica `status=failed` con HTTP 401 de Graph API, revisar la credencial `channels.meta.access_token` en los settings de la base de datos de ese ambiente. Es un problema separado de la facturación de Cloud Run. Las respuestas fallidas del outbox en memoria no se reenvían automáticamente al actualizar el token; enviar un nuevo mensaje de prueba.

Esta configuración permite que la tarea continúe tras responder al webhook, pero Cloud Run aún puede terminar instancias inactivas. Si se requiere entrega garantizada o reintentos durables, mover este trabajo a una cola como Cloud Tasks.
