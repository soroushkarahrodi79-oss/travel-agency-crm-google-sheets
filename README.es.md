# Open Travel CRM para Google Sheets

CRM open source para agencias de viajes construido con Google Sheets y Google
Apps Script. Gestiona leads, reservas, proveedores, localizadores, trayectos,
fechas de ida/vuelta y cobros por plazos.

## Puntos clave

- Sin servidor ni base de datos adicional.
- Los datos permanecen en una hoja propiedad de la agencia.
- Roles `ADMIN` y `AGENT`.
- Un agente solo puede acceder a sus propios leads.
- Acceso con código temporal enviado al correo; los agentes no necesitan acceso
  directo a la hoja.
- Los cobros se pueden editar y anular, pero no borrar.
- Control de sobrepago y saldo pendiente.
- Registro de auditoría.
- Interfaz responsive para escritorio y móvil.
- Sin clientes, correos, IDs ni credenciales reales en el repositorio.

## Instalación rápida

1. Crea una hoja de Google vacía.
2. Crea un proyecto de Google Apps Script.
3. Copia el contenido de [`src/`](src/).
4. En **Configuración del proyecto → Propiedades de secuencia de comandos**
   añade:

   - `TRAVEL_CRM_SPREADSHEET_ID`: ID de la hoja.
   - `TRAVEL_CRM_ADMIN_EMAIL`: correo del primer administrador.

5. Ejecuta `setupTravelCrm_()` desde el editor. El correo temporal se elimina
   de las propiedades al completar la instalación.
6. Despliega como Web App ejecutada por el propietario del despliegue.
7. Añade los correos autorizados en `USERS`; cada usuario recibirá un código
   temporal al iniciar sesión.

Consulta la [guía completa](docs/DEPLOYMENT.md) y
[SECURITY.md](SECURITY.md) antes de usar datos reales.

## Pruebas

```bash
npm test
npm run security:scan
```

Licencia [MIT](LICENSE). Este proyecto no está afiliado con Google.
