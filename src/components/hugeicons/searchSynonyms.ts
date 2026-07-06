/**
 * Search synonym groups for the Icon Library — lets a query like "globe"
 * (or "mundo") also surface icons named "Earth" / "World", without needing
 * per-icon tags (infeasible to hand-tag ~4,567 vendored icons accurately).
 * Each inner array is a set of interchangeable terms: searching for ANY term
 * in a group expands the search to EVERY term in that group.
 *
 * BILINGÜE: cada grupo incluye términos en inglés Y español. El match final
 * se hace contra el NOMBRE (en inglés) del icono, así que el término español
 * solo actúa de "llave" que expande a sus equivalentes en inglés del mismo
 * grupo (buscar "casa" → {home, house} → encuentra HomeIcon). Los acentos se
 * normalizan (ver `normalize`), así "diseño" y "diseno" funcionan igual.
 *
 * Intencionalmente amplio-pero-llano: conceptos cotidianos + el vocabulario
 * de negocio/seguros para el que se usan estos iconos. Añade grupos cuando
 * una búsqueda real quede vacía. Mantén las entradas en minúsculas.
 */
export const SEARCH_SYNONYMS: string[][] = [
  // ── Nature / planet ──────────────────────────────────────────────
  ['globe', 'earth', 'world', 'planet', 'global', 'mundo', 'tierra', 'planeta', 'globo', 'mundial'],
  ['sun', 'sunny', 'solar', 'daylight', 'sol', 'soleado', 'dia'],
  ['moon', 'lunar', 'night', 'luna', 'noche', 'nocturno'],
  ['star', 'starred', 'favorite', 'favourite', 'estrella', 'favorito', 'destacado'],
  ['cloud', 'weather', 'sky', 'nube', 'clima', 'tiempo', 'cielo'],
  ['rain', 'rainy', 'shower', 'storm', 'lluvia', 'lluvioso', 'tormenta'],
  ['snow', 'snowy', 'winter', 'ice', 'frost', 'nieve', 'invierno', 'hielo', 'escarcha'],
  ['wind', 'windy', 'breeze', 'viento', 'brisa', 'aire'],
  ['fire', 'flame', 'burn', 'hot', 'fuego', 'llama', 'fogata', 'calor'],
  ['water', 'liquid', 'drop', 'droplet', 'agua', 'liquido', 'gota'],
  ['mountain', 'hill', 'peak', 'montana', 'cerro', 'colina', 'cima'],
  ['tree', 'plant', 'forest', 'nature', 'leaf', 'arbol', 'planta', 'bosque', 'naturaleza', 'hoja'],
  ['flower', 'bloom', 'blossom', 'flor', 'florecer'],
  ['animal', 'pet', 'animales', 'mascota'],
  ['dog', 'puppy', 'canine', 'perro', 'cachorro', 'perrito'],
  ['cat', 'kitten', 'feline', 'gato', 'gatito', 'felino'],
  ['bird', 'pajaro', 'ave'],
  ['fish', 'pez', 'pescado'],
  ['temperature', 'thermometer', 'temperatura', 'termometro'],
  ['recycle', 'recycling', 'eco', 'environment', 'sustainable', 'green', 'reciclar', 'reciclaje', 'ecologico', 'medioambiente', 'sostenible', 'verde'],

  // ── Money / finance ──────────────────────────────────────────────
  ['money', 'cash', 'dollar', 'currency', 'coin', 'finance', 'financial', 'dinero', 'efectivo', 'dolar', 'moneda', 'divisa', 'finanzas', 'financiero', 'plata'],
  ['bank', 'banking', 'account', 'banco', 'bancario', 'cuenta'],
  ['wallet', 'purse', 'billetera', 'cartera', 'monedero'],
  ['payment', 'pay', 'checkout', 'transaction', 'pago', 'pagar', 'cobro', 'transaccion'],
  ['invoice', 'bill', 'receipt', 'factura', 'recibo', 'boleta', 'comprobante'],
  ['budget', 'expense', 'spending', 'presupuesto', 'gasto', 'gastos'],
  ['profit', 'revenue', 'earnings', 'income', 'ganancia', 'ingreso', 'ingresos', 'utilidad'],
  ['tax', 'taxes', 'impuesto', 'impuestos', 'iva'],
  ['loan', 'credit', 'debt', 'mortgage', 'prestamo', 'credito', 'deuda', 'hipoteca'],
  ['savings', 'save', 'piggy bank', 'ahorro', 'ahorros', 'alcancia'],
  ['exchange', 'convert', 'conversion', 'cambio', 'convertir', 'conversion', 'canje'],
  ['stock', 'stocks', 'shares', 'trading', 'market', 'acciones', 'bolsa', 'mercado'],
  ['investment', 'invest', 'portfolio', 'inversion', 'invertir', 'portafolio'],
  ['card', 'credit card', 'debit', 'tarjeta'],

  // ── Business / legal / insurance ─────────────────────────────────
  ['agreement', 'deal', 'contract', 'handshake', 'negotiation', 'partnership', 'acuerdo', 'trato', 'contrato', 'apreton de manos', 'negociacion', 'sociedad', 'alianza'],
  ['policy', 'coverage', 'insurance', 'poliza', 'cobertura', 'seguro'],
  ['claim', 'claims', 'reclamo', 'reclamacion', 'siniestro'],
  ['quote', 'quotation', 'estimate', 'proposal', 'cotizacion', 'presupuesto', 'estimado', 'propuesta'],
  ['document', 'file', 'paper', 'form', 'documento', 'archivo', 'papel', 'formulario'],
  ['signature', 'sign', 'signing', 'firma', 'firmar'],
  ['certificate', 'certification', 'diploma', 'award', 'certificado', 'certificacion', 'titulo', 'premio'],
  ['license', 'licence', 'permit', 'licencia', 'permiso'],
  ['audit', 'inspection', 'review', 'auditoria', 'inspeccion', 'revision'],
  ['risk', 'hazard', 'danger', 'riesgo', 'peligro', 'amenaza'],
  ['client', 'customer', 'account holder', 'cliente', 'titular'],
  ['broker', 'agent', 'representative', 'corredor', 'agente', 'representante', 'asesor'],
  ['company', 'business', 'organization', 'corporate', 'enterprise', 'empresa', 'negocio', 'organizacion', 'corporativo', 'compania'],
  ['office', 'workplace', 'oficina', 'trabajo'],
  ['meeting', 'conference', 'appointment', 'reunion', 'conferencia', 'cita', 'junta'],
  ['presentation', 'slideshow', 'slides', 'presentacion', 'diapositivas'],
  ['strategy', 'plan', 'planning', 'estrategia', 'plan', 'planificacion'],
  ['goal', 'target', 'objective', 'aim', 'meta', 'objetivo', 'blanco'],
  ['growth', 'increase', 'trend up', 'crecimiento', 'aumento', 'subida', 'alza'],
  ['decline', 'decrease', 'trend down', 'drop', 'caida', 'bajada', 'disminucion', 'descenso'],
  ['report', 'summary', 'analysis', 'reporte', 'informe', 'resumen', 'analisis'],
  ['task', 'todo', 'checklist', 'assignment', 'tarea', 'pendiente', 'lista de tareas', 'asignacion'],
  ['project', 'workflow', 'proyecto', 'flujo de trabajo'],
  ['deadline', 'due date', 'fecha limite', 'vencimiento', 'entrega'],
  ['approval', 'approve', 'accept', 'confirm', 'aprobacion', 'aprobar', 'aceptar', 'confirmar'],
  ['rejection', 'reject', 'deny', 'rechazo', 'rechazar', 'denegar'],
  ['negotiate', 'bargain', 'negociar', 'regatear'],

  // ── People / identity ─────────────────────────────────────────────
  ['user', 'person', 'profile', 'account', 'member', 'contact', 'usuario', 'persona', 'perfil', 'cuenta', 'miembro', 'contacto'],
  ['team', 'group', 'people', 'staff', 'employee', 'employees', 'equipo', 'grupo', 'gente', 'personal', 'empleado', 'empleados'],
  ['manager', 'boss', 'supervisor', 'leader', 'gerente', 'jefe', 'supervisor', 'lider'],
  ['id', 'identity', 'identification', 'badge', 'identidad', 'identificacion', 'credencial', 'carnet'],
  ['login', 'signin', 'sign in', 'authentication', 'iniciar sesion', 'ingresar', 'acceso', 'autenticacion'],
  ['logout', 'signout', 'sign out', 'cerrar sesion', 'salir'],
  ['register', 'signup', 'sign up', 'enrollment', 'enroll', 'registrarse', 'registro', 'inscribirse', 'inscripcion'],
  ['family', 'household', 'familia', 'hogar'],
  ['baby', 'child', 'kid', 'bebe', 'nino', 'infante'],
  ['man', 'male', 'hombre', 'masculino', 'varon'],
  ['woman', 'female', 'mujer', 'femenino'],
  ['couple', 'relationship', 'pareja', 'relacion'],
  ['friend', 'friends', 'amigo', 'amigos'],

  // ── Communication ──────────────────────────────────────────────
  ['phone', 'call', 'telephone', 'mobile', 'cell', 'dial', 'telefono', 'llamada', 'celular', 'movil', 'marcar'],
  ['email', 'mail', 'letter', 'envelope', 'message', 'correo', 'carta', 'sobre', 'mensaje'],
  ['chat', 'conversation', 'talk', 'discussion', 'conversacion', 'hablar', 'mensajes', 'platica'],
  ['notification', 'alert', 'reminder', 'bell', 'notificacion', 'alerta', 'recordatorio', 'campana', 'aviso'],
  ['share', 'send', 'forward', 'compartir', 'enviar', 'reenviar'],
  ['broadcast', 'announcement', 'megaphone', 'anuncio', 'megafono', 'difusion'],
  ['contact us', 'support', 'help desk', 'helpdesk', 'soporte', 'ayuda', 'atencion', 'contacto'],
  ['feedback', 'comment', 'comentario', 'opinion', 'retroalimentacion'],
  ['question', 'query', 'faq', 'help', 'pregunta', 'duda', 'consulta', 'ayuda'],
  ['inbox', 'mailbox', 'bandeja', 'buzon'],

  // ── Time ──────────────────────────────────────────────────────────
  ['calendar', 'date', 'schedule', 'event', 'appointment', 'calendario', 'fecha', 'agenda', 'evento', 'cita'],
  ['clock', 'time', 'hour', 'timer', 'watch', 'stopwatch', 'reloj', 'tiempo', 'hora', 'temporizador', 'cronometro'],
  ['history', 'past', 'log', 'timeline', 'historial', 'pasado', 'registro', 'linea de tiempo'],
  ['future', 'upcoming', 'forecast', 'futuro', 'proximo', 'pronostico'],
  ['reminder', 'alarm', 'recordatorio', 'alarma'],
  ['duration', 'countdown', 'duracion', 'cuenta regresiva'],

  // ── Files / documents ──────────────────────────────────────────────
  ['folder', 'directory', 'carpeta', 'directorio'],
  ['pdf'],
  ['spreadsheet', 'excel', 'xls', 'hoja de calculo', 'planilla'],
  ['word', 'doc', 'text document', 'documento de texto'],
  ['image', 'photo', 'picture', 'photograph', 'imagen', 'foto', 'fotografia', 'ilustracion'],
  ['attachment', 'clip', 'paperclip', 'adjunto', 'clip', 'anexo'],
  ['archive', 'zip', 'compress', 'comprimir', 'comprimido'],
  ['backup', 'restore', 'respaldo', 'copia de seguridad', 'restaurar'],
  ['cloud storage', 'drive', 'almacenamiento', 'nube'],
  ['print', 'printer', 'printing', 'imprimir', 'impresora', 'impresion'],
  ['scan', 'scanner', 'escanear', 'escaner'],
  ['clipboard', 'paste', 'portapapeles', 'pegar'],

  // ── Actions / CRUD ──────────────────────────────────────────────
  ['delete', 'trash', 'remove', 'bin', 'discard', 'eliminar', 'borrar', 'basura', 'papelera', 'quitar', 'descartar'],
  ['edit', 'pencil', 'modify', 'change', 'update', 'write', 'editar', 'lapiz', 'modificar', 'cambiar', 'actualizar', 'escribir'],
  ['add', 'plus', 'create', 'new', 'insert', 'agregar', 'anadir', 'mas', 'crear', 'nuevo', 'insertar'],
  ['search', 'find', 'magnify', 'lookup', 'look up', 'zoom', 'buscar', 'busqueda', 'lupa', 'encontrar'],
  ['filter', 'sort', 'refine', 'filtro', 'filtrar', 'ordenar', 'clasificar'],
  ['settings', 'gear', 'config', 'configuration', 'preferences', 'options', 'ajustes', 'configuracion', 'engranaje', 'preferencias', 'opciones'],
  ['download', 'descargar', 'bajar'],
  ['upload', 'import', 'subir', 'cargar', 'importar'],
  ['copy', 'duplicate', 'clone', 'copiar', 'duplicar', 'clonar'],
  ['cut', 'cortar'],
  ['undo', 'revert', 'deshacer', 'revertir'],
  ['redo', 'rehacer'],
  ['refresh', 'reload', 'sync', 'synchronize', 'actualizar', 'recargar', 'sincronizar'],
  ['expand', 'maximize', 'fullscreen', 'expandir', 'maximizar', 'pantalla completa'],
  ['collapse', 'minimize', 'shrink', 'colapsar', 'minimizar', 'reducir'],
  ['drag', 'move', 'reorder', 'arrastrar', 'mover', 'reordenar'],
  ['select', 'choose', 'pick', 'seleccionar', 'elegir', 'escoger'],
  ['toggle', 'switch', 'alternar', 'interruptor'],
  ['check', 'checkmark', 'tick', 'done', 'complete', 'success', 'verificar', 'palomita', 'listo', 'completo', 'hecho', 'exito', 'correcto'],
  ['cancel', 'close', 'dismiss', 'exit', 'cancelar', 'cerrar', 'salir'],
  ['play', 'start', 'run', 'begin', 'reproducir', 'iniciar', 'empezar', 'comenzar'],
  ['pause', 'stop', 'halt', 'pausa', 'pausar', 'detener', 'parar'],
  ['loading', 'progress', 'spinner', 'cargando', 'progreso'],
  ['save', 'guardar'],
  ['lock edit', 'block'],

  // ── Navigation / direction ──────────────────────────────────────
  ['home', 'house', 'main', 'casa', 'hogar', 'inicio', 'principal'],
  ['back', 'return', 'previous', 'atras', 'volver', 'regresar', 'anterior'],
  ['next', 'forward', 'continue', 'siguiente', 'adelante', 'continuar', 'proximo'],
  ['up', 'top', 'ascend', 'arriba', 'subir'],
  ['down', 'bottom', 'descend', 'abajo', 'bajar'],
  ['left', 'izquierda'],
  ['right', 'derecha'],
  ['arrow', 'direction', 'pointer', 'flecha', 'direccion'],
  ['menu', 'hamburger', 'navigation', 'menu', 'navegacion'],
  ['sidebar', 'panel', 'barra lateral'],
  ['tab', 'tabs', 'pestana', 'pestanas'],
  ['breadcrumb', 'migas'],
  ['link', 'url', 'hyperlink', 'enlace', 'vinculo', 'liga'],
  ['external link', 'open in new', 'enlace externo', 'abrir en nueva'],

  // ── Media ──────────────────────────────────────────────────────────
  ['video', 'movie', 'film', 'clip', 'pelicula', 'filme'],
  ['music', 'audio', 'sound', 'song', 'musica', 'sonido', 'cancion'],
  ['camera', 'photo', 'photography', 'camara', 'foto', 'fotografia'],
  ['microphone', 'mic', 'record', 'recording', 'microfono', 'grabar', 'grabacion'],
  ['speaker', 'volume', 'loudspeaker', 'altavoz', 'volumen', 'bocina', 'parlante'],
  ['mute', 'silent', 'silenciar', 'silencio', 'mudo'],
  ['gallery', 'album', 'galeria'],
  ['live', 'streaming', 'stream', 'en vivo', 'transmision'],
  ['podcast'],

  // ── Shopping / commerce ──────────────────────────────────────────
  ['cart', 'basket', 'bag', 'shopping', 'carrito', 'canasta', 'compra', 'compras'],
  ['store', 'shop', 'market', 'marketplace', 'storefront', 'tienda', 'mercado', 'comercio'],
  ['product', 'item', 'goods', 'producto', 'articulo', 'mercancia'],
  ['price', 'cost', 'pricing', 'precio', 'costo', 'tarifa'],
  ['discount', 'coupon', 'sale', 'offer', 'promo', 'descuento', 'cupon', 'oferta', 'rebaja', 'promocion'],
  ['delivery', 'shipping', 'package', 'parcel', 'entrega', 'envio', 'paquete', 'reparto'],
  ['order', 'purchase', 'buy', 'pedido', 'orden', 'compra', 'comprar'],
  ['gift', 'present', 'regalo', 'obsequio'],
  ['barcode', 'qr code', 'scan code', 'codigo de barras', 'codigo qr'],

  // ── Tech / devices ──────────────────────────────────────────────
  ['computer', 'desktop', 'pc', 'computadora', 'ordenador', 'escritorio'],
  ['laptop', 'notebook', 'portatil'],
  ['mobile', 'smartphone', 'device', 'celular', 'movil', 'dispositivo'],
  ['tablet', 'ipad', 'tableta'],
  ['keyboard', 'type', 'typing', 'teclado', 'teclear', 'escribir'],
  ['mouse', 'cursor', 'click', 'raton', 'clic'],
  ['wifi', 'internet', 'network', 'connection', 'red', 'conexion'],
  ['server', 'hosting', 'servidor'],
  ['database', 'storage', 'data', 'base de datos', 'almacenamiento', 'datos'],
  ['code', 'programming', 'developer', 'software', 'codigo', 'programacion', 'desarrollador'],
  ['bug', 'error', 'issue', 'problem', 'error', 'fallo', 'problema', 'bicho'],
  ['api', 'integration', 'integracion'],
  ['bluetooth', 'wireless', 'inalambrico'],
  ['battery', 'power', 'charge', 'charging', 'bateria', 'energia', 'carga', 'cargando', 'pila'],
  ['screen', 'display', 'monitor', 'pantalla'],
  ['usb', 'cable', 'plug', 'enchufe', 'conector'],
  ['app', 'application', 'aplicacion'],
  ['robot', 'ai', 'artificial intelligence', 'automation', 'inteligencia artificial', 'automatizacion'],

  // ── Security ──────────────────────────────────────────────────────
  ['lock', 'security', 'password', 'protect', 'secure', 'candado', 'seguridad', 'contrasena', 'clave', 'proteger', 'seguro'],
  ['unlock', 'access', 'desbloquear', 'abrir', 'acceso'],
  ['key', 'credentials', 'llave', 'clave', 'credenciales'],
  ['shield', 'protection', 'safety', 'guard', 'escudo', 'proteccion', 'seguridad'],
  ['privacy', 'confidential', 'private', 'privacidad', 'confidencial', 'privado'],
  ['fingerprint', 'biometric', 'huella', 'biometrico'],
  ['warning', 'caution', 'advertencia', 'precaucion', 'cuidado'],
  ['error', 'fail', 'failure', 'wrong', 'fallo', 'error', 'incorrecto'],
  ['info', 'information', 'informacion'],
  ['ban', 'block', 'forbidden', 'restricted', 'bloquear', 'prohibido', 'restringido', 'vetar'],

  // ── Visibility ──────────────────────────────────────────────────
  ['eye', 'view', 'see', 'visibility', 'watch', 'preview', 'ojo', 'ver', 'visibilidad', 'vista previa'],
  ['hide', 'invisible', 'hidden', 'ocultar', 'oculto', 'invisible'],
  ['spy', 'monitor', 'surveillance', 'espia', 'vigilancia'],

  // ── Transport ──────────────────────────────────────────────────
  ['car', 'vehicle', 'automobile', 'auto', 'carro', 'coche', 'vehiculo', 'automovil'],
  ['truck', 'lorry', 'camion'],
  ['plane', 'flight', 'airplane', 'aircraft', 'jet', 'avion', 'aviones', 'avioneta', 'aeroplano', 'aereo', 'vuelo', 'aeronave'],
  ['ship', 'boat', 'vessel', 'barco', 'bote', 'embarcacion'],
  ['train', 'railway', 'railroad', 'tren', 'ferrocarril'],
  ['bus', 'autobus', 'camioneta'],
  ['bike', 'bicycle', 'cycling', 'bici', 'bicicleta', 'ciclismo'],
  ['motorcycle', 'motorbike', 'moto', 'motocicleta'],
  ['taxi', 'cab', 'ride', 'viaje'],
  ['fuel', 'gas', 'petrol', 'combustible', 'gasolina'],
  ['road', 'street', 'highway', 'camino', 'calle', 'carretera'],
  ['traffic', 'trafico'],
  ['parking', 'estacionamiento', 'aparcamiento'],

  // ── Location / maps ──────────────────────────────────────────────
  ['map', 'location', 'pin', 'place', 'gps', 'position', 'mapa', 'ubicacion', 'lugar', 'posicion'],
  ['navigation', 'route', 'directions', 'compass', 'navegacion', 'ruta', 'direcciones', 'brujula'],
  ['distance', 'nearby', 'distancia', 'cerca'],
  ['country', 'nation', 'pais', 'nacion'],
  ['city', 'town', 'ciudad', 'pueblo'],
  ['flag', 'nationality', 'bandera', 'nacionalidad'],

  // ── Health / medical ──────────────────────────────────────────────
  ['heart', 'health', 'cardiac', 'pulse', 'corazon', 'salud', 'cardiaco', 'pulso'],
  ['medical', 'medicine', 'doctor', 'hospital', 'clinic', 'medico', 'medicina', 'clinica'],
  ['pill', 'medication', 'drug', 'prescription', 'pastilla', 'medicamento', 'receta'],
  ['first aid', 'emergency', 'ambulance', 'primeros auxilios', 'emergencia', 'ambulancia'],
  ['nurse', 'enfermera', 'enfermero'],
  ['dna', 'genetics', 'adn', 'genetica'],
  ['virus', 'bacteria', 'germ', 'germen'],
  ['mask', 'mascarilla', 'cubrebocas'],
  ['fitness', 'exercise', 'workout', 'gym', 'ejercicio', 'entrenamiento', 'gimnasio'],
  ['wheelchair', 'disability', 'accessibility', 'silla de ruedas', 'discapacidad', 'accesibilidad'],
  ['tooth', 'dental', 'dentist', 'diente', 'dentista'],
  ['brain', 'mind', 'mental', 'cerebro', 'mente'],

  // ── Food / drink ──────────────────────────────────────────────
  ['food', 'meal', 'eat', 'dining', 'restaurant', 'comida', 'comer', 'restaurante'],
  ['drink', 'beverage', 'bebida', 'trago'],
  ['coffee', 'cafe', 'espresso'],
  ['tea', 'te'],
  ['fruit', 'apple', 'banana', 'fruta', 'manzana', 'platano'],
  ['vegetable', 'veggie', 'verdura', 'vegetal'],
  ['pizza'],
  ['burger', 'hamburger', 'fast food', 'hamburguesa', 'comida rapida'],
  ['cake', 'dessert', 'sweet', 'pastel', 'postre', 'dulce', 'torta'],
  ['wine', 'alcohol', 'beer', 'vino', 'cerveza'],
  ['kitchen', 'cooking', 'chef', 'cocina', 'cocinar'],

  // ── Shapes / basics ──────────────────────────────────────────────
  ['circle', 'round', 'oval', 'circulo', 'redondo', 'ovalo'],
  ['square', 'box', 'rectangle', 'cuadrado', 'caja', 'rectangulo'],
  ['triangle', 'triangulo'],
  ['grid', 'layout', 'table', 'cuadricula', 'rejilla', 'tabla'],
  ['list', 'bullet', 'items', 'lista', 'vineta'],
  ['dot', 'point', 'marker', 'punto', 'marcador'],

  // ── Charts / analytics ──────────────────────────────────────────
  ['chart', 'graph', 'statistics', 'stats', 'analytics', 'grafico', 'grafica', 'estadisticas', 'analitica'],
  ['pie chart', 'proportion', 'grafico circular', 'grafico de pastel', 'proporcion'],
  ['bar chart', 'grafico de barras'],
  ['line chart', 'trend', 'grafico de lineas', 'tendencia'],
  ['dashboard', 'overview', 'tablero', 'panel', 'resumen'],
  ['percentage', 'percent', 'ratio', 'porcentaje', 'por ciento', 'proporcion'],
  ['funnel', 'pipeline', 'embudo'],

  // ── Social / engagement ──────────────────────────────────────────
  ['like', 'thumbs up', 'upvote', 'me gusta', 'pulgar arriba'],
  ['dislike', 'thumbs down', 'downvote', 'no me gusta', 'pulgar abajo'],
  ['rating', 'review', 'stars', 'calificacion', 'valoracion', 'resena', 'estrellas'],
  ['smile', 'happy', 'emoji', 'sonrisa', 'feliz', 'contento'],
  ['sad', 'unhappy', 'frown', 'triste'],
  ['angry', 'mad', 'enojado', 'molesto'],
  ['love', 'heart', 'amor', 'corazon'],
  ['follow', 'subscribe', 'seguir', 'suscribir'],
  ['trophy', 'award', 'winner', 'achievement', 'medal', 'trofeo', 'premio', 'ganador', 'logro', 'medalla'],

  // ── Sports / activity ──────────────────────────────────────────
  ['sport', 'sports', 'game', 'athletic', 'deporte', 'deportes', 'juego'],
  ['ball', 'soccer', 'football', 'basketball', 'pelota', 'balon', 'futbol', 'baloncesto', 'basquet'],
  ['run', 'running', 'jog', 'jogging', 'correr', 'trotar'],
  ['swim', 'swimming', 'pool', 'nadar', 'natacion', 'piscina', 'alberca'],
  ['yoga', 'meditation', 'relax', 'meditacion', 'relajar'],

  // ── Buildings / places ──────────────────────────────────────────
  ['building', 'skyscraper', 'tower', 'edificio', 'rascacielos', 'torre'],
  ['school', 'university', 'college', 'education', 'escuela', 'universidad', 'educacion', 'colegio'],
  ['factory', 'industrial', 'warehouse', 'fabrica', 'almacen', 'bodega'],
  ['church', 'temple', 'religion', 'iglesia', 'templo', 'religion'],
  ['hotel', 'lodging', 'hospedaje', 'alojamiento'],
  ['airport', 'aeropuerto'],

  // ── Household / objects ──────────────────────────────────────────
  ['bed', 'sleep', 'bedroom', 'cama', 'dormir', 'dormitorio', 'recamara'],
  ['chair', 'furniture', 'seat', 'silla', 'mueble', 'asiento'],
  ['lamp', 'light', 'lighting', 'lampara', 'luz', 'iluminacion'],
  ['tool', 'tools', 'wrench', 'hammer', 'repair', 'fix', 'herramienta', 'herramientas', 'llave inglesa', 'martillo', 'reparar', 'arreglar'],
  ['trash can', 'garbage', 'waste', 'bote de basura', 'basura', 'desecho'],
  ['umbrella', 'paraguas', 'sombrilla'],
  ['bag', 'backpack', 'luggage', 'suitcase', 'bolsa', 'mochila', 'maleta', 'equipaje'],
  ['glasses', 'eyewear', 'lentes', 'anteojos', 'gafas'],
  ['clothes', 'clothing', 'shirt', 'apparel', 'ropa', 'camisa', 'vestimenta', 'prenda'],
  ['shoe', 'shoes', 'footwear', 'zapato', 'zapatos', 'calzado'],

  // ── Design / creative (útiles para el equipo de diseño) ──────────
  ['design', 'brush', 'paint', 'palette', 'creative', 'diseno', 'pincel', 'pintar', 'paleta', 'creativo'],
  ['color', 'colour', 'swatch', 'color', 'muestra'],
  ['crop', 'resize', 'recortar', 'redimensionar'],
  ['layers', 'layer', 'capas', 'capa'],
  ['vector', 'pen tool', 'vectorial', 'pluma'],
  ['ruler', 'measure', 'regla', 'medir', 'medida'],
  ['magic', 'ai edit', 'magia', 'varita'],
  ['text', 'font', 'typography', 'texto', 'fuente', 'tipografia'],
  ['align', 'alignment', 'alinear', 'alineacion'],
];

/** Normaliza para el matching bilingüe: quita acentos/diacríticos y pasa a minúsculas,
 *  así "Diseño", "diseño" y "diseno" se comparan igual. */
function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

const PARTIAL_SYNONYM_MIN_CHARS = 3;
const FUZZY_SYNONYM_MIN_CHARS = 5;
const DEFAULT_SUGGESTION_LIMIT = 8;

type SynonymGroup = {
  termsList: string[];
};

type CandidateSource =
  | 'query'
  | 'query-variant'
  | 'synonym-exact'
  | 'synonym-partial'
  | 'synonym-fuzzy';

type SearchTermCandidate = {
  term: string;
  score: number;
  source: CandidateSource;
};

type SearchQuery = {
  normalized: string;
  compact: string;
  tokens: string[];
  terms: SearchTermCandidate[];
  suggestions: string[];
};

type IconSearchMeta = {
  words: string[];
  searchableWords: string[];
  compactName: string;
  compactNameNoIcon: string;
  initials: string;
};

const normalizedSynonymGroups: SynonymGroup[] = SEARCH_SYNONYMS.map((group) => {
  const termsList = [...new Set(group.map((term) => normalize(term)))];
  return { termsList };
});

const allSynonymTerms = [...new Set(normalizedSynonymGroups.flatMap((group) => group.termsList))];

function addGroupToIndex(index: Map<string, SynonymGroup[]>, key: string, group: SynonymGroup) {
  const groups = index.get(key);
  if (groups) {
    if (!groups.includes(group)) groups.push(group);
  } else {
    index.set(key, [group]);
  }
}

const groupIndex: Map<string, SynonymGroup[]> = (() => {
  const index = new Map<string, SynonymGroup[]>();
  for (const group of normalizedSynonymGroups) {
    for (const term of group.termsList) addGroupToIndex(index, term, group);
  }
  return index;
})();

const partialGroupIndex: Map<string, SynonymGroup[]> = (() => {
  const index = new Map<string, SynonymGroup[]>();
  for (const group of normalizedSynonymGroups) {
    for (const term of group.termsList) {
      const compactTerm = compact(term);
      for (let length = PARTIAL_SYNONYM_MIN_CHARS; length <= compactTerm.length; length++) {
        addGroupToIndex(index, compactTerm.slice(0, length), group);
      }
    }
  }
  return index;
})();

function compact(s: string): string {
  return s.replace(/\s+/g, '');
}

function addCandidate(
  candidates: Map<string, SearchTermCandidate>,
  term: string,
  score: number,
  source: CandidateSource
) {
  const normalized = normalize(term.trim());
  if (!normalized) return;

  const current = candidates.get(normalized);
  if (!current || score > current.score) {
    candidates.set(normalized, { term: normalized, score, source });
  }
}

function addGroupCandidates(
  candidates: Map<string, SearchTermCandidate>,
  groups: SynonymGroup[] | undefined,
  score: number,
  source: CandidateSource
): boolean {
  if (!groups) return false;
  for (const group of groups) {
    for (const term of group.termsList) addCandidate(candidates, term, score, source);
  }
  return true;
}

function addSuggestion(suggestions: Map<string, number>, term: string, score: number) {
  const current = suggestions.get(term);
  if (current === undefined || score > current) suggestions.set(term, score);
}

function addGroupSuggestions(
  suggestions: Map<string, number>,
  groups: SynonymGroup[] | undefined,
  fragment: string,
  score: number
) {
  if (!groups) return;

  const compactFragment = compact(fragment);
  for (const group of groups) {
    for (const term of group.termsList) {
      if (term === fragment) continue;
      const termScore = compact(term).startsWith(compactFragment) ? score + 20 : score;
      addSuggestion(suggestions, term, termScore);
    }
  }
}

function tokenVariants(fragment: string): string[] {
  const variants = new Set<string>([fragment]);
  if (fragment.length <= 3) return [...variants];

  if (fragment.endsWith('ies') && fragment.length > 4) variants.add(`${fragment.slice(0, -3)}y`);
  if (fragment.endsWith('ves') && fragment.length > 4) {
    variants.add(`${fragment.slice(0, -3)}f`);
    variants.add(`${fragment.slice(0, -3)}fe`);
  }
  if (fragment.endsWith('es') && fragment.length > 4) variants.add(fragment.slice(0, -2));
  if (fragment.endsWith('s') && fragment.length > 3) variants.add(fragment.slice(0, -1));

  return [...variants];
}

function fuzzyThreshold(term: string): number {
  if (term.length >= 8) return 2;
  if (term.length >= FUZZY_SYNONYM_MIN_CHARS) return 1;
  return 0;
}

function editDistance(a: string, b: string, maxDistance: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = current[0];

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost
      );
      current[j] = value;
      rowMin = Math.min(rowMin, value);
    }

    if (rowMin > maxDistance) return maxDistance + 1;
    previous = current;
  }

  return previous[b.length];
}

function fuzzyMatches(a: string, b: string): boolean {
  const maxDistance = fuzzyThreshold(a);
  if (maxDistance === 0) return false;
  if (a[0] !== b[0]) return false;
  return editDistance(a, b, maxDistance) <= maxDistance;
}

function addSynonymMatches(
  candidates: Map<string, SearchTermCandidate>,
  suggestions: Map<string, number>,
  fragment: string
) {
  if (!fragment) return;

  const exactGroups = groupIndex.get(fragment);
  const foundExactGroup = addGroupCandidates(candidates, exactGroups, 190, 'synonym-exact');
  addGroupSuggestions(suggestions, exactGroups, fragment, 90);
  if (foundExactGroup) return;

  const compactFragment = compact(fragment);
  if (compactFragment.length >= PARTIAL_SYNONYM_MIN_CHARS) {
    const partialGroups = partialGroupIndex.get(compactFragment);
    addGroupCandidates(candidates, partialGroups, 150, 'synonym-partial');
    addGroupSuggestions(suggestions, partialGroups, fragment, 70);
  }

  if (fragment.length < FUZZY_SYNONYM_MIN_CHARS) return;

  const fuzzyGroups = new Set<SynonymGroup>();
  for (const term of allSynonymTerms) {
    if (fuzzyMatches(fragment, term)) {
      for (const group of groupIndex.get(term) ?? []) fuzzyGroups.add(group);
      addSuggestion(suggestions, term, 65);
    }
  }
  addGroupCandidates(candidates, [...fuzzyGroups], 130, 'synonym-fuzzy');
}

function buildSearchQuery(query: string): SearchQuery {
  const normalized = normalize(query.trim());
  if (!normalized) {
    return { normalized: '', compact: '', tokens: [], terms: [], suggestions: [] };
  }

  const candidates = new Map<string, SearchTermCandidate>();
  const suggestions = new Map<string, number>();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const fragments = [...new Set([normalized, ...tokens])];

  addCandidate(candidates, normalized, 260, 'query');

  for (const fragment of fragments) {
    for (const variant of tokenVariants(fragment)) {
      addCandidate(candidates, variant, variant === fragment ? 250 : 230, 'query-variant');
      addSynonymMatches(candidates, suggestions, variant);
    }
  }

  suggestions.delete(normalized);

  return {
    normalized,
    compact: compact(normalized),
    tokens,
    terms: [...candidates.values()],
    suggestions: [...suggestions.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))
      .map(([term]) => term),
  };
}

/**
 * Expands a raw search query into every term it should ALSO match — the
 * original query plus every synonym-group it belongs to.  Multi-word
 * queries are expanded word-by-word so "money transfer" still benefits
 * from the "money" group.  Partial synonym keys kick in from 3 characters,
 * so "avio" expands through "avion" into "airplane" / "plane".  Acentos
 * normalizados (búsqueda en español).
 */
export function expandSearchTerms(query: string): string[] {
  return buildSearchQuery(query).terms.map((candidate) => candidate.term);
}

export function getSearchSuggestions(query: string, limit = DEFAULT_SUGGESTION_LIMIT): string[] {
  return buildSearchQuery(query).suggestions.slice(0, limit);
}

/**
 * Splits a PascalCase icon name into lowercase words — "AirplaneTakeOff01Icon"
 * → ["airplane", "take", "off01", "icon"].  Matching word-by-word (rather
 * than one long substring) avoids false hits where two adjacent words
 * happen to spell a third: "airplane" + "Takeoff" contains the literal
 * substring "planet" at the join, which a whole-name `.includes()` would
 * wrongly surface for a "globe/planet" search.
 */
function splitIconWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean);
}

const metaCache = new Map<string, IconSearchMeta>();
function metaFor(name: string): IconSearchMeta {
  let meta = metaCache.get(name);
  if (meta) return meta;

  const words = splitIconWords(name).map(normalize);
  const searchableWords = words.filter((word) => word !== 'icon');
  const compactName = compact(words.join(''));
  const compactNameNoIcon = compact(searchableWords.join(''));
  const initials = searchableWords.map((word) => word[0]).join('');

  meta = { words, searchableWords, compactName, compactNameNoIcon, initials };
  metaCache.set(name, meta);
  return meta;
}

function wordsFor(name: string): string[] {
  return metaFor(name).words;
}

/**
 * Does `term` match `words` starting exactly at `words[startIdx]`'s own
 * boundary?  Consumes whole words one at a time; the LAST word touched may
 * be a prefix match (so a still-being-typed query like "glob" matches the
 * word "globe").  Requiring the match to start at a boundary — rather than
 * anywhere inside a word — is what tells "discount"+"tag01" (two whole
 * words, legitimately concatenated) apart from "airplane"+"t" (one whole
 * word plus a stray leading fragment of the next): typing "discounttag01"
 * should find `DiscountTag01Icon`, but "planet" must NOT find
 * `AirplaneTakeOff01Icon` just because "airplane" + "Takeoff" happens to
 * spell it at the join.
 */
function matchesFromWordBoundary(words: string[], startIdx: number, term: string): boolean {
  let remaining = term;
  for (let i = startIdx; i < words.length; i++) {
    const word = words[i];
    if (word.length >= remaining.length) return word.startsWith(remaining);
    if (!remaining.startsWith(word)) return false;
    remaining = remaining.slice(word.length);
  }
  return remaining.length === 0;
}

function normalizedWord(word: string): string {
  return word.replace(/\d+$/, '');
}

function bestFuzzyWordScore(words: string[], term: string): number {
  const maxDistance = fuzzyThreshold(term);
  if (maxDistance === 0) return 0;

  let best = 0;
  for (const word of words) {
    const plainWord = normalizedWord(word);
    if (!plainWord || plainWord[0] !== term[0]) continue;
    const distance = editDistance(term, plainWord, maxDistance);
    if (distance <= maxDistance) best = Math.max(best, 115 - distance * 25);
  }
  return best;
}

function scoreTermForIcon(meta: IconSearchMeta, candidate: SearchTermCandidate): number {
  const termCompact = compact(candidate.term);
  if (!termCompact) return 0;
  const cameFromSynonym = candidate.source.startsWith('synonym');
  const fullNameBonus = cameFromSynonym ? 50 : 90;
  const prefixBonus = cameFromSynonym ? 50 : 75;
  const wordBonus = cameFromSynonym ? 50 : 70;
  const wordPrefixBonus = cameFromSynonym ? 45 : 55;

  if (meta.compactNameNoIcon === termCompact) return candidate.score + fullNameBonus;
  if (meta.compactNameNoIcon.startsWith(termCompact)) return candidate.score + prefixBonus;
  if (meta.compactName === termCompact || meta.compactName.startsWith(termCompact)) {
    return candidate.score + prefixBonus;
  }

  for (const word of meta.searchableWords) {
    const plainWord = normalizedWord(word);
    if (word === termCompact || plainWord === termCompact) return candidate.score + wordBonus;
    if (word.startsWith(termCompact) || plainWord.startsWith(termCompact)) return candidate.score + wordPrefixBonus;
  }

  if (meta.words.some((_, i) => matchesFromWordBoundary(meta.words, i, termCompact))) {
    return candidate.score + wordPrefixBonus;
  }

  if (candidate.source === 'query' || candidate.source === 'query-variant') {
    return bestFuzzyWordScore(meta.searchableWords, termCompact);
  }

  return 0;
}

function scoreIconName(name: string, search: SearchQuery): number {
  const meta = metaFor(name);
  let best = 0;

  if (search.compact) {
    if (meta.compactNameNoIcon === search.compact) best = Math.max(best, 420);
    if (meta.compactNameNoIcon.startsWith(search.compact)) best = Math.max(best, 390);
    if (search.compact.length >= 2 && meta.initials.startsWith(search.compact)) {
      best = Math.max(best, meta.initials === search.compact ? 340 : 300);
    }
  }

  for (const candidate of search.terms) {
    best = Math.max(best, scoreTermForIcon(meta, candidate));
  }

  return best;
}

/**
 * True if `name` matches the (already-expanded) search `terms`.  Multi-word
 * synonym phrases ("pie chart") are compacted to "piechart" first — the
 * word-boundary walk above then requires them to appear as consecutive
 * whole words, same as any other term.
 */
export function iconNameMatches(name: string, terms: string[]): boolean {
  const words = wordsFor(name);
  return terms.some((term) => {
    const termCompact = compact(normalize(term));
    return words.some((_, i) => matchesFromWordBoundary(words, i, termCompact));
  });
}

/** Filters and ranks `names` against a raw query — synonym-expanded, word-aware, typo-tolerant. */
export function filterIconNames(names: readonly string[], query: string): string[] {
  const search = buildSearchQuery(query);
  if (search.terms.length === 0) return [...names];

  return names
    .map((name, index) => ({ name, index, score: scoreIconName(name, search) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((result) => result.name);
}
