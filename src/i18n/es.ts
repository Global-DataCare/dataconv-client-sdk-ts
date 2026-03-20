import type { 
  SubjectFieldKey, 
  ProductFieldKey, 
  InvoiceFieldKey, 
  DocumentReferenceFieldKey 
} from '../field-maps.js';

type CombinedKeys = SubjectFieldKey | ProductFieldKey | InvoiceFieldKey | DocumentReferenceFieldKey;

export const esDescriptions: Record<CombinedKeys, string> = {
  // Sujeto
  'subject-id': 'Identificador único del sujeto (paciente, mascota, máquina, edificio).',
  'subject-kind': 'Tipo o naturaleza del sujeto (ej. human, animal, machine, building).',
  'subject-year': 'Año de nacimiento, creación o fabricación del sujeto.',
  'subject-category': 'Categoría superior del sujeto (ej. especie biológica, categoría de producto).',
  'subject-type': 'Subtipo específico del sujeto (ej. raza del animal, modelo de la máquina).',
  'subject-color': 'Color principal o identificativo (ej. color de pelo, color de pintura).',
  'subject-origin': 'Origen del sujeto (ej. identificación de los padres, fabricante, país).',
  'subject-status': 'Estado actual del sujeto (ej. vivo, activo, obsoleto, inactivo).',
  
  // Producto
  'product-id': 'Identificador único del producto, muestra o pieza.',
  'product-kind': 'Naturaleza del producto (ej. muestra biológica, pieza de repuesto, donación).',
  'product-category': 'Categoría general a la que pertenece el producto.',
  'product-parent': 'Identificador del origen o propietario del producto (ej. donante, ensamblaje principal).',
  'product-date': 'Fecha de creación, extracción o manufactura del producto.',
  'product-source': 'Fuente o lugar de donde proviene el producto.',
  'product-facility': 'Instalación o planta donde se gestiona o creó el producto.',
  'product-division': 'División o departamento responsable del producto.',
  'product-line': 'Línea de producción o linaje del producto.',
  'product-status': 'Estado del producto (ej. disponible, consumido, defectuoso, cuarentena).',
  'product-propertytype': 'Tipo de propiedad o característica medida en el producto.',
  'product-propertyvalue': 'Valor de la propiedad o característica especificada.',
  'product-collector': 'Identificador de la persona o entidad que recolectó o recibió el producto.',
  'product-collectionstart': 'Fecha y hora de inicio de la recolección o ensamblaje.',
  'product-collectionend': 'Fecha y hora de fin de la recolección o ensamblaje.',
  'product-collectionprocedure': 'Procedimiento o método utilizado para obtener el producto.',

  // Factura
  'invoice-id': 'Identificador o número de factura.',
  'invoice-status': 'Estado de la factura (ej. draft, issued, paid, cancelled).',
  'invoice-cancelledreason': 'Motivo de cancelación de la factura, si aplica.',
  'invoice-type': 'Tipo de factura o transacción financiera.',
  'invoice-subject': 'Sujeto al que se refiere la factura (ej. el paciente o equipo reparado).',
  'invoice-recipient': 'Receptor o pagador de la factura.',
  'invoice-creation': 'Fecha de creación de la factura.',
  'invoice-billingstart': 'Fecha de inicio del periodo de facturación.',
  'invoice-billingend': 'Fecha de fin del periodo de facturación.',
  'invoice-participantrole': 'Rol de los participantes en la facturación.',
  'invoice-itemcodes': 'Códigos de los artículos, servicios o conceptos facturados.',
  'invoice-totalnet': 'Importe total neto (sin impuestos) de la factura.',
  'invoice-totalgross': 'Importe total bruto (con impuestos) de la factura.',
  'invoice-paymentmethod': 'Método de pago utilizado o acordado.',

  // Documento
  'documentreference_attester': 'Atestiguador del documento (DID o rol: personal, profesional, legal).',
  'documentreference_author': 'Autor o creador de la información fuente.',
  'documentreference_basedon': 'Referencia al recurso origen o solicitud base.',
  'documentreference_category': 'Categoría superior o clasificación del documento.',
  'documentreference_contentdata': 'Datos adjuntos incrustados (ej. base64).',
  'documentreference_contenttype': 'Tipo MIME del contenido adjunto (ej. application/pdf).',
  'documentreference_context': 'Contexto del documento (ej. cita, visita, episodio).',
  'documentreference_creation': 'Fecha y hora de creación de la información original.',
  'documentreference_date': 'Fecha de atestiguación o registro en el sistema.',
  'documentreference_description': 'Resumen o descripción legible por humanos.',
  'documentreference_event-code': 'Código principal del evento o acto (ej. código de diagnóstico o procedimiento).',
  'documentreference_event-reference': 'Referencia a un recurso relacionado con el evento (ej. URL a una Observación).',
  'documentreference_format-uri': 'URI del formato técnico del adjunto.',
  'documentreference_identifier': 'Identificador de negocio para la correlación del documento.',
  'documentreference_language': 'Idioma del contenido del documento (ej. es, en).',
  'documentreference_location': 'URL remota donde se aloja el adjunto.',
  'documentreference_modality': 'Modalidad de imagen o función del equipo.',
  'documentreference_relatesto': 'Referencia a un documento anterior o relacionado.',
  'documentreference_relation': 'Tipo de relación con el documento referenciado (ej. anexa, reemplaza).',
  'documentreference_subject': 'Referencia al índice o sección del individuo.',
  'documentreference_type': 'Tipo específico del documento según el sector.',
};