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
- Instalador de un paso, esquema versionado, diagnóstico y staging verificable.

## Instalación rápida

```bash
git clone https://github.com/soroushkarahrodi79-oss/travel-agency-crm-google-sheets.git
cd travel-agency-crm-google-sheets
npm install
npm run check
clasp login
npm run apps-script:configure -- --script-id YOUR_SCRIPT_ID
npm run apps-script:doctor
```

1. Crea un proyecto independiente de Google Apps Script.
2. Ejecuta `npm run apps-script:push`.
3. Ejecuta `setupTravelCrm()` desde el editor como propietario del despliegue.
4. El instalador crea una hoja nativa y usa tu cuenta como administrador.
5. Para conectar una hoja existente, configura opcionalmente:

   - `TRAVEL_CRM_SPREADSHEET_ID`: ID de la hoja.
   - `TRAVEL_CRM_ADMIN_EMAIL`: correo del primer administrador.

6. Despliega como Web App ejecutada por el propietario del despliegue.
7. Haz la prueba de aceptación de la [guía de despliegue](docs/DEPLOYMENT.md).

Los usuarios registrados reciben un código de un solo uso y no necesitan acceso
directo a la hoja.

[Ver el recorrido de producto de 12 segundos](docs/assets/product-tour.mp4).

## Personalización sin tocar el código

| Propiedad | Valor por defecto |
| --- | --- |
| `TRAVEL_CRM_APP_NAME` | `Open Travel CRM` |
| `TRAVEL_CRM_CURRENCY` | `EUR` |
| `TRAVEL_CRM_LOCALE` | `en-GB` |
| `TRAVEL_CRM_TIME_ZONE` | `Europe/Madrid` |
| `TRAVEL_CRM_ENVIRONMENT` | `production` |

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
npm run media:check
npm run security:scan
npm run release:check
npm run check
npm run staging:check
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
