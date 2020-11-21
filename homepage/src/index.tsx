import 'react-app-polyfill/ie11';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { World } from '../../src/index';
import * as prefabs from './prefabs';
import { plugins } from './plugins';

import './index.css';

const SIZE = 500;

const scene = {
  entities: {
    paddle: {
      id: 'paddle',
      prefab: 'Paddle',
      stores: {
        bodyConfig: {
          shape: 'rectangle',
          density: 1,
          width: 200,
          height: 25,
          restitution: 1,
          angle: 0,
        },
        forces: {
          velocity: { x: 0, y: 0 },
        },
        transform: { x: 0, y: SIZE / 2 },
      },
    },
    ball: {
      id: 'ball',
      prefab: 'Ball',
      stores: {
        bodyConfig: {
          shape: 'circle',
          density: 1,
          radius: 5,
          restitution: 1,
          angle: 0,
        },
        forces: {
          velocity: { x: 0, y: 0 },
        },
        transform: { x: 0, y: 0 },
      },
    },
    leftWall: {
      id: 'leftWall',
      prefab: 'Wall',
      stores: {
        bodyConfig: {
          shape: 'rectangle',
          density: 1,
          width: 10,
          height: SIZE,
          restitution: 1,
          angle: 0,
          isStatic: true,
        },
        transform: { x: -SIZE / 2, y: 0 },
      },
    },
    rightWall: {
      id: 'leftWall',
      prefab: 'Wall',
      stores: {
        bodyConfig: {
          shape: 'rectangle',
          density: 1,
          width: 10,
          height: SIZE,
          restitution: 1,
          angle: 0,
          isStatic: true,
        },
        transform: { x: SIZE / 2, y: 0 },
      },
    },
    topWall: {
      id: 'topWall',
      prefab: 'Wall',
      stores: {
        bodyConfig: {
          shape: 'rectangle',
          density: 1,
          width: SIZE,
          height: 10,
          restitution: 1,
          angle: 0,
          isStatic: true,
        },
        transform: { x: 0, y: -SIZE / 2 },
      },
    },
  },
};

const App = () => {
  return (
    <div className="CenterSpaceTransformer">
      <World prefabs={prefabs} scene={scene} plugins={plugins} />
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
