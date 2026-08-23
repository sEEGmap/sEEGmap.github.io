// Core data model for sEEGplan.
// Coordinates are normalized (0..1) relative to the full brain-template.png image,
// which is the single master coordinate system for the whole workspace.

export type Point = { x: number; y: number };

export type ElectrodeType = "lateral-medial" | "superior-inferior";

export interface BaseElectrode {
  id: string;
  name: string;
  color: string;
  entryName: string;
  targetName: string;
  notes: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface LateralMedialElectrode extends BaseElectrode {
  type: "lateral-medial";
  entry: Point;
  target: Point;
}

export interface SuperiorInferiorElectrode extends BaseElectrode {
  type: "superior-inferior";
  lateralStart: Point;
  lateralEnd: Point;
  medialStart: Point;
  medialEnd: Point;
}

export type Electrode = LateralMedialElectrode | SuperiorInferiorElectrode;

export interface AnatomyRecord {
  id: string;
  targetName: string;
  preferredEntry: string;
  targetX: number;
  targetY: number;
  entryX: number;
  entryY: number;
  category: string;
  comments: string;
}

export interface AppConfig {
  institution: string;
  contact: string;
  email: string;
  phone: string;
}

export interface QuadrantConfig {
  label: string;
  bbox: [number, number, number, number];
  anteriorAtStart: boolean;
}

export interface BrainRegionsConfig {
  referenceWidth: number;
  referenceHeight: number;
  quadrants: {
    leftLateral: QuadrantConfig;
    rightLateral: QuadrantConfig;
    leftMedial: QuadrantConfig;
    rightMedial: QuadrantConfig;
  };
  grid: { columns: string[]; rows: string[] };
}

export interface SIAnchor {
  lateralStart: [number, number];
  lateralEnd: [number, number];
  medialStart: [number, number];
  medialEnd: [number, number];
}

export type SIRegionsConfig = Record<string, SIAnchor>;

export interface SeegPlanFile {
  formatVersion: string;
  appVersion: string;
  createdAt: string;
  updatedAt: string;
  patientLabel: string;
  planNotes: string;
  electrodes: Electrode[];
}

export const CURRENT_FORMAT_VERSION = "1.0";
