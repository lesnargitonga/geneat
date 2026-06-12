export const HAZINA_VAULT_REVEAL_EVENT = "hazina:vault-reveal";
export const HAZINA_STAGE_MOTION_STATE_EVENT = "hazina:stage-motion-state";
export const HAZINA_STAGE_ORIENTATION_EVENT = "hazina:stage-orientation";

export type StageMotionStateDetail = {
  enabled: boolean;
};

export type StageOrientationDetail = {
  active: boolean;
  x: number;
  y: number;
};
