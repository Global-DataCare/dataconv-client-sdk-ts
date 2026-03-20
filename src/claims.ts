/**
 * Automatically generated DataLocal Search Claims.
 * Format generated from data field mapping names.
 */

export const GlobalSearchClaims = [
  'section',
  'family',
  'subfamily',
  'concept',
  'date',
  'time',
  'origin',
] as const;

export const PersonalSearchClaims = [
  'Personal.id',
] as const;

export const SubjectSearchClaims = [
  'Subject.id',
  'Subject.address-country',
  'Subject.address-postalcode',
  'Subject.animal-species',
  'Subject.animal-breeds',
  'Subject.birthyear',
  'Subject.birthsex',
  'Subject.animal-genderstatus',
  'Subject.gender',
] as const;

export const AppointmentSearchClaims = [
  'Appointment.lastoccurrence',
] as const;

export const EncounterSearchClaims = [
  'Encounter.participant-type-display',
  'Encounter.service-type-display',
] as const;

export const ChargeitemSearchClaims = [
  'Chargeitem.identifier',
] as const;

export const CoverageSearchClaims = [
  'Coverage.insurer',
  'Coverage.status',
  'Coverage.period-start',
  'Coverage.period-end',
] as const;

export const LocationSearchClaims = [
  'Location.address-postalcode',
  'Location.address-city',
  'Location.address-district',
  'Location.address-state',
] as const;

export const ObservationSearchClaims = [
  'Observation.weight',
] as const;

export const ProcedureSearchClaims = [
  'Procedure.code-display',
  'Procedure.followup-date',
  'Procedure.subpotent-date',
  'Procedure.target-display',
] as const;

export const DataLocalSearchClaims = [
  ...GlobalSearchClaims,
  ...PersonalSearchClaims,
  ...SubjectSearchClaims,
  ...AppointmentSearchClaims,
  ...EncounterSearchClaims,
  ...ChargeitemSearchClaims,
  ...CoverageSearchClaims,
  ...LocationSearchClaims,
  ...ObservationSearchClaims,
  ...ProcedureSearchClaims,
] as const;

export type GlobalSearchClaim = typeof GlobalSearchClaims[number];
export type PersonalSearchClaim = typeof PersonalSearchClaims[number];
export type SubjectSearchClaim = typeof SubjectSearchClaims[number];
export type AppointmentSearchClaim = typeof AppointmentSearchClaims[number];
export type EncounterSearchClaim = typeof EncounterSearchClaims[number];
export type ChargeitemSearchClaim = typeof ChargeitemSearchClaims[number];
export type CoverageSearchClaim = typeof CoverageSearchClaims[number];
export type LocationSearchClaim = typeof LocationSearchClaims[number];
export type ObservationSearchClaim = typeof ObservationSearchClaims[number];
export type ProcedureSearchClaim = typeof ProcedureSearchClaims[number];
export type DataLocalSearchClaim = typeof DataLocalSearchClaims[number];
