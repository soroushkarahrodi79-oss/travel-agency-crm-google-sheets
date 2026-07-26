<div align="center">

# Open Travel CRM para Google Sheets

**Un CRM seguro y autogestionado para agencias de viajes, construido con Google Sheets y Apps Script.**

[Demo interactiva](https://soroushkarahrodi79-oss.github.io/travel-agency-crm-google-sheets/) ·
[Instalación](docs/DEPLOYMENT.md) ·
[Arquitectura](docs/ARCHITECTURE.md) ·
[English](README.md)

</div>

## Qué problema resuelve

Open Travel CRM cubre el espacio entre una hoja de cálculo desordenada y un CRM
SaaS costoso o excesivamente genérico. La agencia conserva la propiedad de la
hoja y del despliegue, mientras la aplicación añade permisos en servidor,
gestión comercial, cobros por plazos y trazabilidad.

No requiere servidor de base de datos, compilación frontend ni dependencias npm
en producción.

## Funcionalidad

- Leads, estados comerciales, búsqueda, filtros y asignación por agente.
- Proveedor, localizador, trayecto, destino, fechas y pasajeros.
- Presupuesto, venta final, próxima acción y seguimientos vencidos.
- Cobros por plazos con saldo, control de sobrepago, edición y anulación auditable.
- Sincronización automática entre el saldo y el estado de la venta.
- Roles `ADMIN` y `AGENT`; cada agente solo accede a sus propios leads.
- Acceso mediante código temporal enviado al correo.
- Gestión de usuarios desde la aplicación, sin compartir la hoja.
- Marca, moneda, locale y zona horaria configurables por despliegue.
- Instalador idempotente, esquema versionado, diagnóstico de salud y CI.

## Instalación rápida

```bash
git clone https://github.com/soroushkarahrodi79-oss/travel-agency-crm-google-sheets.git
cd travel-agency-crm-google-sheets
npm install
npm run check
npm install --global @google/clasp
clasp login
cp .clasp.json.example .clasp.json
```

1. Crea una hoja de Google vacía.
2. Crea un proyecto independiente de Google Apps Script.
3. Sustituye `YOUR_SCRIPT_ID` en `.clasp.json` y ejecuta `clasp push`.
4. Añade estas propiedades de secuencia de comandos:

   - `TRAVEL_CRM_SPREADSHEET_ID`: ID de la hoja.
   - `TRAVEL_CRM_ADMIN_EMAIL`: correo del primer administrador.

5. Ejecuta `setupTravelCrm_()` manualmente desde el editor.
6. Despliega como Web App ejecutada por el propietario del despliegue.
7. Haz la prueba de aceptación de la [guía de despliegue](docs/DEPLOYMENT.md).

Los usuarios registrados reciben un código de un solo uso y no necesitan acceso
directo a la hoja.

## Personalización sin tocar el código

| Propiedad | Valor por defecto |
| --- | --- |
| `TRAVEL_CRM_APP_NAME` | `Open Travel CRM` |
| `TRAVEL_CRM_CURRENCY` | `EUR` |
| `TRAVEL_CRM_LOCALE` | `en-GB` |
| `TRAVEL_CRM_TIME_ZONE` | `Europe/Madrid` |

Consulta [Configuración](docs/CONFIGURATION.md) para ver formatos y ejemplos.

## Seguridad

- El navegador se considera no confiable.
- El servidor vuelve a validar sesión, rol, propietario y totales en cada operación.
- La emisión y verificación de códigos está limitada, bloqueada frente a carreras y no revela si existe una cuenta.
- Las sesiones activas se invalidan al desactivar un usuario o cambiar su rol.
- Los cobros se anulan, nunca se borran físicamente.
- Se neutralizan valores que podrían convertirse en fórmulas de Sheets.
- Los IDs reales, correos de clientes y credenciales no forman parte del repositorio.

Este proyecto no sustituye una auditoría legal ni una certificación de
cumplimiento. No almacenes tarjetas completas, contraseñas ni documentos de
identidad. Lee [SECURITY.md](SECURITY.md) y el
[modelo de amenazas](docs/SECURITY_MODEL.md).

## Calidad

```bash
npm test
npm run docs:check
npm run security:scan
npm run release:check
npm run check
```

## Documentación y comunidad

- [Despliegue](docs/DEPLOYMENT.md)
- [Configuración](docs/CONFIGURATION.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Diccionario de datos](docs/DATA_DICTIONARY.md)
- [Operaciones](docs/OPERATIONS.md)
- [Actualizaciones](docs/UPGRADING.md)
- [Contribución](CONTRIBUTING.md)
- [Soporte](SUPPORT.md)

Licencia [MIT](LICENSE). Open Travel CRM es un proyecto independiente y no está
afiliado con Google.
