export const SubjectFieldKeys = [
  'subject-id',
  'subject-kind',
  'subject-year',
  'subject-category',
  'subject-type',
  'subject-color',
  'subject-origin',
  'subject-status',
] as const;

export type SubjectFieldKey = typeof SubjectFieldKeys[number];

export const ProductFieldKeys = [
  'product-id',
  'product-kind',
  'product-category',
  'product-parent',
  'product-date',
  'product-source',
  'product-facility',
  'product-division',
  'product-line',
  'product-status',
  'product-propertytype',
  'product-propertyvalue',
  'product-collector',
  'product-collectionstart',
  'product-collectionend',
  'product-collectionprocedure',
] as const;

export type ProductFieldKey = typeof ProductFieldKeys[number];

export const InvoiceFieldKeys = [
  'invoice-id',
  'invoice-status',
  'invoice-cancelledreason',
  'invoice-type',
  'invoice-subject',
  'invoice-recipient',
  'invoice-creation',
  'invoice-billingstart',
  'invoice-billingend',
  'invoice-participantrole',
  'invoice-itemcodes',
  'invoice-totalnet',
  'invoice-totalgross',
  'invoice-paymentmethod',
] as const;

export type InvoiceFieldKey = typeof InvoiceFieldKeys[number];

export const DocumentReferenceFieldKeys = [
  'documentreference_attester',
  'documentreference_author',
  'documentreference_basedon',
  'documentreference_category',
  'documentreference_contentdata',
  'documentreference_contenttype',
  'documentreference_context',
  'documentreference_creation',
  'documentreference_date',
  'documentreference_description',
  'documentreference_event-code',
  'documentreference_event-reference',
  'documentreference_format-uri',
  'documentreference_identifier',
  'documentreference_language',
  'documentreference_location',
  'documentreference_modality',
  'documentreference_relatesto',
  'documentreference_relation',
  'documentreference_subject',
  'documentreference_type',
] as const;

export type DocumentReferenceFieldKey = typeof DocumentReferenceFieldKeys[number];

export type DataConvFieldMapBase = {
  [K in SubjectFieldKey | ProductFieldKey | InvoiceFieldKey | DocumentReferenceFieldKey]?: string;
} & {
  [key: string]: string | undefined;
};

export interface FieldsGenericCare extends DataConvFieldMapBase {
  condition_code?: string;
  condition_severity?: string;
  observation_code?: string;
  observation_value?: string;
  procedure_code?: string;
  procedure_status?: string;
  
  // Legacy
  section?: string;
  family?: string;
  subfamily?: string;
  concept?: string;
  date?: string;
  time?: string;
}

export interface FieldsHealthCare extends FieldsGenericCare {
  patient_id?: string;
}

export interface FieldsAnimalCare extends FieldsGenericCare {
  species?: string;
  breed?: string;
}

export const DataLocalFieldKeys = [
  'section',
  'family',
  'subfamily',
  'concept',
  'date',
  'time',
  'origin',
  'personal_id',
  'subject_id',
  'subject_address-country',
  'subject_address-postalcode',
  'subject_animal-species',
  'subject_animal-breeds',
  'subject_birthyear',
  'subject_birthsex',
  'subject_animal-genderstatus',
  'subject_gender',
  'appointment_lastoccurrence',
  'encounter_participant-type-display',
  'encounter_service-type-display',
  'chargeitem_identifier',
  'coverage_insurer',
  'coverage_status',
  'coverage_period-start',
  'coverage_period-end',
  'location_address-postalcode',
  'location_address-city',
  'location_address-district',
  'location_address-state',
  'observation_weight',
  'procedure_code-display',
  'procedure_followup-date',
  'procedure_subpotent-date',
  'procedure_target-display',
] as const;

export type DataLocalFieldKey = typeof DataLocalFieldKeys[number];
