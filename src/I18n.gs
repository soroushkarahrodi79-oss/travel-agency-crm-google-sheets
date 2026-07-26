/**
 * Open Travel CRM — user-facing message catalogue.
 *
 * Translations are keyed by their English source string, the convention
 * gettext uses. English therefore stays readable in the source, in the Apps
 * Script editor and in execution logs, and a missing translation degrades to
 * English instead of surfacing a raw key.
 *
 * Two categories are deliberately NOT translated:
 *
 * 1. Operator diagnostics (installer, schema guard, staging acceptance and
 *    TRAVEL_CRM_* configuration validation) keep a single greppable wording so
 *    deployment logs, CI output and runbooks stay stable across locales.
 * 2. Anything thrown from getRuntimeConfig_ itself, because resolving a
 *    translation reads the runtime configuration and would recurse forever.
 */
const OTC_MESSAGES = Object.freeze({
  es: Object.freeze({
    // Authentication and session errors.
    'Your session is missing or invalid.': 'Falta tu sesión o no es válida.',
    'Your session has expired. Sign in again.':
      'Tu sesión ha caducado. Inicia sesión de nuevo.',
    'Your session is invalid. Sign in again.':
      'Tu sesión no es válida. Inicia sesión de nuevo.',
    'Your CRM account is disabled or no longer registered.':
      'Tu cuenta del CRM está deshabilitada o ya no está registrada.',
    'The account is disabled or no longer registered.':
      'La cuenta está deshabilitada o ya no está registrada.',
    'You do not have permission for this action.':
      'No tienes permiso para realizar esta acción.',
    'The code is invalid or expired.': 'El código no es válido o ha caducado.',
    'The code has expired.': 'El código ha caducado.',
    'Too many attempts. Request a new code.':
      'Demasiados intentos. Solicita un código nuevo.',

    // Lead and reservation errors.
    'Lead not found.': 'Lead no encontrado.',
    'This lead belongs to another agent.': 'Este lead pertenece a otro agente.',
    'Name is required.': 'El nombre es obligatorio.',
    'Phone must contain at least seven digits.':
      'El teléfono debe contener al menos siete dígitos.',
    'Travel end cannot be earlier than travel start.':
      'La fecha de fin del viaje no puede ser anterior a la de inicio.',
    'Selected owner is disabled or not registered in USERS.':
      'El propietario seleccionado está deshabilitado o no está registrado en USERS.',
    'Invalid status filter.': 'Filtro de estado no válido.',
    'Invalid follow-up scope.': 'Rango de seguimiento no válido.',
    'Invalid date.': 'Fecha no válida.',

    // Payment errors.
    'Payment not found.': 'Pago no encontrado.',
    'Payment date is required.': 'La fecha de pago es obligatoria.',
    'Payment does not belong to this lead.': 'El pago no pertenece a este lead.',
    'Payment would exceed the sale total.':
      'El pago superaría el importe total de la venta.',
    'This payment is already cancelled.': 'Este pago ya está cancelado.',
    'A cancelled payment cannot be edited.':
      'No se puede editar un pago cancelado.',
    'Payment and cancellation reason are required.':
      'El pago y el motivo de cancelación son obligatorios.',
    'A sale total is required while active payments exist.':
      'Se requiere un importe de venta mientras existan pagos activos.',

    // User administration errors.
    'Enter a valid user email.': 'Introduce un correo de usuario válido.',
    'Display name is required.': 'El nombre visible es obligatorio.',
    'The CRM must retain at least one active administrator.':
      'El CRM debe conservar al menos un administrador activo.',
    'You cannot change your own administrator access.':
      'No puedes cambiar tu propio acceso de administrador.',

    // Sign-in screen.
    'Skip to main content': 'Saltar al contenido principal',
    'Enter the email registered by your CRM administrator. We will send a one-time access code.':
      'Introduce el correo registrado por el administrador del CRM. Te enviaremos un código de acceso de un solo uso.',
    'Work email': 'Correo de trabajo',
    'Send access code': 'Enviar código de acceso',
    '6-digit code': 'Código de 6 dígitos',
    'Sign in securely': 'Iniciar sesión de forma segura',
    'Use another email': 'Usar otro correo',
    'Codes expire after 10 minutes. Access is limited to active users in the USERS sheet.':
      'Los códigos caducan a los 10 minutos. El acceso se limita a los usuarios activos de la hoja USERS.',

    // Navigation and shell.
    'Google Sheets edition': 'Edición Google Sheets',
    'Dashboard': 'Panel',
    'Follow-ups': 'Seguimientos',
    'New lead': 'Nuevo lead',
    'Users': 'Usuarios',
    'Sign out': 'Cerrar sesión',
    'Open-source sample · No customer data is bundled.':
      'Ejemplo de código abierto · No incluye datos de clientes.',
    'Leads, bookings and installment payments in one workspace.':
      'Leads, reservas y pagos fraccionados en un solo espacio.',

    // Dashboard.
    'Sales overview': 'Resumen comercial',
    'Accessible leads': 'Leads accesibles',
    // Identical in Spanish, but listed explicitly so the coverage gate proves
    // it was a decision rather than an oversight.
    'Pipeline': 'Pipeline',
    'Confirmed sales': 'Ventas confirmadas',
    'Outstanding balance': 'Saldo pendiente',
    'Overdue follow-ups': 'Seguimientos vencidos',
    'Win rate': 'Tasa de conversión',
    'Recent leads': 'Leads recientes',
    'Your latest commercial activity.': 'Tu actividad comercial más reciente.',
    'View all': 'Ver todos',

    // Lead directory.
    'Lead directory': 'Directorio de leads',
    'Search by name, phone, destination, status or ID.':
      'Busca por nombre, teléfono, destino, estado o ID.',
    'Search leads…': 'Buscar leads…',
    'Filter by status': 'Filtrar por estado',
    'All statuses': 'Todos los estados',
    'Search': 'Buscar',
    'No leads found.': 'No se han encontrado leads.',
    'Open': 'Abrir',

    // Follow-up queue.
    'Follow-up queue': 'Cola de seguimiento',
    'Leads waiting for your next action, most urgent first.':
      'Leads a la espera de tu próxima acción, primero los más urgentes.',
    'Follow-up range': 'Rango de seguimiento',
    'Overdue': 'Vencidos',
    'Today': 'Hoy',
    'Next 7 days': 'Próximos 7 días',
    'Nothing to follow up in this range.': 'Nada que seguir en este rango.',
    'Follow-up': 'Seguimiento',

    // Lead editor.
    'Customer file': 'Ficha del cliente',
    'Loading lead…': 'Cargando lead…',
    'Create lead': 'Crear lead',
    'Edit lead': 'Editar lead',
    'Customer, trip and commercial details.':
      'Datos del cliente, del viaje y comerciales.',
    'Name': 'Nombre',
    'Customer name': 'Nombre del cliente',
    'Phone / WhatsApp': 'Teléfono / WhatsApp',
    'International phone': 'Teléfono internacional',
    'Owner': 'Propietario',
    'Source': 'Origen',
    'Status': 'Estado',
    'Service': 'Servicio',
    'Destination': 'Destino',
    'Provider': 'Proveedor',
    'Booking locator': 'Localizador de reserva',
    'Route': 'Ruta',
    'Budget': 'Presupuesto',
    'Sale amount': 'Importe de venta',
    'Travel start': 'Inicio del viaje',
    'Travel end': 'Fin del viaje',
    'Passengers': 'Pasajeros',
    'Next follow-up': 'Próximo seguimiento',
    'Next action': 'Próxima acción',
    'Notes': 'Notas',
    'Save lead': 'Guardar lead',
    'Back': 'Volver',
    'Lead saved.': 'Lead guardado.',
    'Discard unsaved lead changes?':
      '¿Descartar los cambios sin guardar del lead?',

    // Payments.
    'Add payment': 'Añadir pago',
    'Update payment': 'Actualizar pago',
    'Payment date': 'Fecha de pago',
    'Amount': 'Importe',
    'Method': 'Método',
    'Reference': 'Referencia',
    'Operation or receipt number': 'Número de operación o recibo',
    'Optional note': 'Nota opcional',
    'Payment saved.': 'Pago guardado.',
    'Installment payments': 'Pagos fraccionados',
    'Movements are auditable; cancellations are never deleted.':
      'Los movimientos son auditables; las cancelaciones nunca se eliminan.',
    'No payments recorded yet.': 'Aún no hay pagos registrados.',
    'Sale total': 'Total de la venta',
    'Cancel payment': 'Cancelar pago',
    'The movement will remain in the audit trail and the outstanding balance will be recalculated.':
      'El movimiento permanecerá en el registro de auditoría y se recalculará el saldo pendiente.',
    'Cancellation reason': 'Motivo de cancelación',
    'Explain why this payment is being cancelled':
      'Explica por qué se cancela este pago',
    'Confirm cancellation': 'Confirmar cancelación',
    'Keep payment': 'Mantener pago',
    'Payment cancelled and retained in the audit trail.':
      'Pago cancelado y conservado en el registro de auditoría.',
    'Save lead changes before managing payments.':
      'Guarda los cambios del lead antes de gestionar pagos.',
    'Save lead changes before editing payments.':
      'Guarda los cambios del lead antes de editar pagos.',
    'Save lead changes before cancelling payments.':
      'Guarda los cambios del lead antes de cancelar pagos.',
    'Edit': 'Editar',
    'Cancel': 'Cancelar',
    'Paid': 'Pagado',
    'Balance': 'Saldo',
    'Total': 'Total',

    // Outstanding balance and aging report.
    'Balances': 'Saldos',
    'Outstanding balances': 'Saldos pendientes',
    'Money still to collect, aged against each departure date.':
      'Dinero pendiente de cobro, clasificado según la fecha de salida.',
    'Leads with balance': 'Leads con saldo',
    'Collected': 'Cobrado',
    // Lower-case on purpose: it follows a count inside a summary tile.
    'leads': 'leads',
    'Travel already started': 'Viaje ya iniciado',
    'Due within 7 days': 'Vence en 7 días',
    'Due within 30 days': 'Vence en 30 días',
    'Scheduled': 'Programado',
    'No travel date': 'Sin fecha de viaje',
    'Nothing outstanding. Every accessible lead is fully collected.':
      'No hay saldos pendientes. Todos los leads accesibles están cobrados.',
    'Download CSV': 'Descargar CSV',
    'There is nothing to export yet.': 'Todavía no hay nada que exportar.',
    'Lead ID': 'ID del lead',
    'Phone': 'Teléfono',
    'Days to travel': 'Días hasta el viaje',
    'Last payment': 'Último pago',
    'Aging bucket': 'Tramo de antigüedad',

    // User administration.
    'User access': 'Acceso de usuarios',
    'Invite, promote or disable CRM users without sharing the spreadsheet.':
      'Invita, promociona o deshabilita usuarios del CRM sin compartir la hoja de cálculo.',
    'Email': 'Correo',
    'Display name': 'Nombre visible',
    'Agent name': 'Nombre del agente',
    'Role': 'Rol',
    'Access': 'Acceso',
    'Administrator': 'Administrador',
    'Active': 'Activo',
    'Disabled': 'Deshabilitado',
    'Save user': 'Guardar usuario',
    'Clear': 'Limpiar',
    'User access saved.': 'Acceso de usuario guardado.',
    'No users found.': 'No se han encontrado usuarios.',

    // Enumerated values, rendered through the humanising label helper.
    'New': 'Nuevo',
    'Contacted': 'Contactado',
    'Quoted': 'Cotizado',
    'Negotiation': 'Negociación',
    'Booked Pending Payment': 'Reservado pendiente de pago',
    'Closed Won': 'Ganado',
    'Lost': 'Perdido',
    'Flight': 'Vuelo',
    'Package': 'Paquete',
    'Insurance': 'Seguro',
    'Visa': 'Visado',
    'Other': 'Otro',
    'Whatsapp': 'WhatsApp',
    'Call': 'Llamada',
    'Referral': 'Referido',
    'Card': 'Tarjeta',
    'Bank Transfer': 'Transferencia bancaria',
    'Cash': 'Efectivo',
    'Financing': 'Financiación',
    'Admin': 'Administrador',
    'Agent': 'Agente',
    'Cancelled': 'Cancelado',

    // Generic feedback.
    'Unexpected error': 'Error inesperado'
  })
});

/**
 * Resolves a locale such as "es-ES" to a catalogue language, falling back to
 * English whenever no catalogue is available for it.
 */
function messageLanguage_(locale) {
  const language = String(locale || '').trim().slice(0, 2).toLowerCase();
  return OTC_MESSAGES[language] ? language : 'en';
}

/**
 * Translates a user-facing string into the deployment language.
 * Never call this from getRuntimeConfig_ — see the note at the top of the file.
 */
function t_(text) {
  const dictionary = OTC_MESSAGES[
    messageLanguage_(getRuntimeConfig_().locale)
  ];
  return (dictionary && dictionary[text]) || text;
}

/**
 * Catalogue handed to the Web App so the browser can translate its own
 * chrome without a round trip per string.
 */
function uiMessages_() {
  return OTC_MESSAGES[messageLanguage_(getRuntimeConfig_().locale)] || {};
}
