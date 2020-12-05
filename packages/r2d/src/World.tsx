import * as React from 'react';
import { useFrame as useFrameDefault, FrameHook } from './useFrame';
import { proxy } from 'valtio';
import {
  Plugins,
  Prefab,
  WorldContext,
  GlobalStore,
  FrameData,
  EntityData,
  WorldApi,
  Stores,
} from './types';
import { PluginProviders } from './internal/PluginProviders';
import { keyboard, pointer } from './input';
import { EventEmitter } from 'events';
import { Entity } from './Entity';
import { DefaultScenePrefab } from './DefaultScenePrefab';
import shortid from 'shortid';
import { mergeDeepRight } from 'ramda';
import { DebugUI } from './tools/DebugUI';
import { System } from './system';
import { initializeStores } from './internal/initializeStores';

export const worldContext = React.createContext<WorldContext | null>(null);

export type WorldProps = {
  prefabs: Record<string, Prefab<Stores>>;
  useFrame?: FrameHook;
  plugins?: Plugins;
  scene?: GlobalStore;
  systems: System<any, any>[];
};

export type ExtractPrefabNames<W extends WorldProps> = keyof W['prefabs'];

export const defaultScene = {
  tree: {
    id: 'scene',
    children: {},
  },
  entities: {
    scene: {
      id: 'scene',
      storesData: {},
      prefab: 'Scene',
      parentId: null,
    },
  },
};

const createGlobalStore = (initial: GlobalStore = defaultScene) =>
  proxy<GlobalStore>(initial);

function useWorldApi(store: GlobalStore, prefabs: Record<string, Prefab<any>>) {
  const get = React.useCallback(
    (id: string) => {
      return store.entities[id] ?? null;
    },
    [store]
  );

  const add = React.useCallback(
    (
      prefabName: string,
      initialStores: Record<string, any> = {},
      ownId: string | null = null
    ) => {
      const id = ownId || `${prefabName}-${shortid()}`;

      const prefab = prefabs[prefabName];

      const entity: EntityData = {
        id,
        prefab: prefabName,
        storesData: mergeDeepRight(initializeStores(prefab), initialStores),
      };

      store.entities[id] = entity;
      return store.entities[id];
    },
    [store, prefabs]
  );

  const destroy = React.useCallback(
    (id: string) => {
      const e= store.entities[id];
      delete store.entities[id];
      return e;
    },
    [store]
  );

  return {
    get,
    add,
    destroy,
  };
}

function loadProvidedScene(api: WorldApi, scene: GlobalStore) {
  let entity: EntityData;
  for (entity of Object.values(scene.entities)) {
    api.add(entity.prefab, entity.storesData, entity.id);
  }
}

function useDebugMode(setPaused: (p: boolean) => void) {
  const [isDebug, setIsDebug] = React.useState(false);
  React.useEffect(() => {
    function handleKey(ev: KeyboardEvent) {
      if (ev.key === '/') {
        setIsDebug((v) => {
          setPaused(!v);
          return !v;
        });
      }
    }
    window.addEventListener('keypress', handleKey);
    return () => {
      window.removeEventListener('keypress', handleKey);
    };
  }, [setPaused]);

  return isDebug;
}

export const World: React.FC<WorldProps> = ({
  prefabs,
  useFrame = useFrameDefault,
  plugins = {},
  scene,
  systems,
}) => {
  // validation
  if (scene && !scene.entities) {
    throw new Error('Invalid scene prop, must have entities');
  }

  const [globalStore] = React.useState(() => createGlobalStore(scene));

  // DEBUG
  React.useEffect(() => {
    (window as any).globalStore = globalStore;
  }, [globalStore]);

  const prefabsRef = React.useRef<Record<string, Prefab<any>>>({
    Scene: DefaultScenePrefab,
    ...prefabs,
  });
  const systemsRef = React.useRef<System<any, any>[]>(systems);
  const pluginsList = React.useMemo(() => Object.values(plugins), [plugins]);

  const [events] = React.useState(() => {
    const e = new EventEmitter();
    e.setMaxListeners(10000);
    return e;
  });

  const pluginApis = React.useMemo(
    () =>
      Object.entries(plugins).reduce<Record<string, Record<string, unknown>>>(
        (apis, [name, plugin]) => {
          apis[name] = plugin.api;
          return apis;
        },
        {}
      ),
    [plugins]
  );

  const api = useWorldApi(globalStore, prefabsRef.current);
  const { get, add, destroy } = api;
  const [removeList] = React.useState(() => new Array<string>());
  const remove = React.useCallback(
    (id: string) => {
      removeList.push(id);
    },
    [removeList]
  );

  // React.useEffect(() => {
  //   if (scene) loadProvidedScene({ get, add, remove }, scene);
  //   // TODO: reset after scene change?
  // }, [scene, get, add, remove]);

  const context = React.useMemo<WorldContext>(
    () => ({
      events,
      prefabs: prefabsRef.current,
      store: globalStore,
      input: {
        keyboard,
        pointer,
      },
      plugins: pluginApis,
      get,
      add,
      remove,
      systems: systemsRef.current,
    }),
    [events, prefabsRef, globalStore, pluginApis, get, add, remove]
  );

  const disposeEntity = React.useCallback(
    (entity: EntityData) => {
      let system: System<any, any>;
      const ctx = { world: context, entity };
      for (system of systemsRef.current) {
        system.dispose(ctx);
      }
    },
    [context]
  );

  const [paused, setPaused] = React.useState(false);
  const frameCtxRef = React.useRef({
    world: context,
    frame: (null as unknown) as FrameData,
  });
  const loop = React.useCallback(
    (frameData) => {
      frameCtxRef.current.frame = frameData;

      events.emit('preStep', frameData);

      for (const plugin of pluginsList) {
        plugin.run?.(frameCtxRef.current);
      }

      events.emit('step', frameData);

      events.emit('postStep', frameData);

      // Cleanup removed entity subtrees
      let id = removeList.shift();
      while (id) {
        const removed = destroy(id);
        disposeEntity(removed);
        id = removeList.shift();
      }

      keyboard.frame();
      pointer.frame();
    },
    [events, pluginsList, removeList, destroy, disposeEntity]
  );
  useFrame(loop, paused);

  const isDebug = useDebugMode(setPaused);

  return (
    <worldContext.Provider value={context}>
      <PluginProviders plugins={plugins}>
        <>
          <Entity id="scene" prefab="Scene" initial={{}} />
          {isDebug && <DebugUI />}
        </>
      </PluginProviders>
    </worldContext.Provider>
  );
};

export function useWorld() {
  const world = React.useContext(worldContext);
  if (!world) {
    throw new Error('Must be called within World');
  }
  return world;
}