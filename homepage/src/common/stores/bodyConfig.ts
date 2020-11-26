import { r2d } from '../../../..';

export type BodyConfigData = {
  friction: number;
  frictionAir: number;
  isStatic: boolean;
  angle: number;
  restitution: number;
  bullet: boolean;
  fixedRotation: boolean;
} & (
  | {
      shape: 'circle';
      radius: number;
      density: number;
    }
  | {
      shape: 'rectangle';
      width: number;
      height: number;
      density: number;
    }
);

export const bodyConfig = r2d.store<BodyConfigData>({
  shape: 'circle',
  radius: 1,
  density: 1,
  frictionAir: 0,
  friction: 0,
  isStatic: false,
  angle: 0,
  restitution: 0,
  bullet: false,
  fixedRotation: false,
});