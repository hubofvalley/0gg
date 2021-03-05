import { EventEmitter } from 'events';
import { QueryManager } from './QueryManager';
import { ComponentType, ComponentInstance } from './Component';
import { ComponentManager } from './ComponentManager';
import { IdManager } from './IdManager';
import { ArchetypeManager } from './ArchetypeManager';
import { Operation, OperationQueue } from './operations';
import { Entity } from './Entity';
import { ResourceManager } from './resources/ResourceManager';
import { ObjectPool } from './internal/objectPool';
import { logger } from './logger';

export type GameConstants = {
  maxComponentId: number;
  maxEntities: number;
};

export interface GameEvents {
  preStep(): any;
  step(): any;
  postStep(): any;
  stepComplete(): any;
  preApplyOperations(): any;
}

export declare interface Game {
  on<U extends keyof GameEvents>(event: U, callback: GameEvents[U]): this;
  off<U extends keyof GameEvents>(event: U, callback: GameEvents[U]): this;
  emit<U extends keyof GameEvents>(
    event: U,
    ...args: Parameters<GameEvents[U]>
  ): boolean;
}

export class Game extends EventEmitter {
  private _queryManager: QueryManager;
  private _idManager = new IdManager();
  private _archetypeManager: ArchetypeManager;
  private _operationQueue: OperationQueue = [];
  private _componentManager: ComponentManager;
  private _resourceManager = new ResourceManager();
  private _runnableCleanups: (() => void)[];
  private _entityPool = new ObjectPool(() => new Entity());

  // TODO: configurable?
  private _phases = ['preStep', 'step', 'postStep'] as const;

  private _delta = 0;
  private _time = 0;

  globals: Map<string, any>;

  private _constants: GameConstants = {
    maxComponentId: 256,
    maxEntities: 2 ** 16,
  };

  constructor({
    components,
    systems = [],
    globals = new Map(),
  }: {
    components: ComponentType<any>[];
    systems?: ((game: Game) => () => void)[];
    globals?: Map<string, any>;
  }) {
    super();
    this.setMaxListeners(Infinity);
    this._componentManager = new ComponentManager(components, this);
    this._queryManager = new QueryManager(this);
    this._archetypeManager = new ArchetypeManager(this);
    this._runnableCleanups = systems.map((sys) => sys(this));
    this.globals = globals;
  }

  get idManager() {
    return this._idManager;
  }
  get componentManager() {
    return this._componentManager;
  }
  get archetypeManager() {
    return this._archetypeManager;
  }
  get delta() {
    return this._delta;
  }
  get time() {
    return this._time;
  }
  get queryManager() {
    return this._queryManager;
  }
  get constants() {
    return this._constants;
  }
  get resourceManager() {
    return this._resourceManager;
  }
  get entityPool() {
    return this._entityPool;
  }

  create = () => {
    const id = this.idManager.get();
    this._operationQueue.push({
      op: 'createEntity',
      entityId: id,
    });
    return id;
  };

  destroy = (id: number) => {
    this._operationQueue.push({
      op: 'destroyEntity',
      entityId: id,
    });
  };

  add = <ComponentShape>(
    entityId: number,
    Type: ComponentType<ComponentShape>,
    initial?: Partial<ComponentShape>,
  ) => {
    this._operationQueue.push({
      op: 'addComponent',
      entityId,
      componentType: Type.id,
      initialValues: initial,
    });
  };

  remove = <T extends ComponentType<any>>(entityId: number, Type: T) => {
    this._operationQueue.push({
      op: 'removeComponent',
      entityId,
      componentType: Type.id,
    });
  };

  get = (entityId: number): Entity<any> | null => {
    return this.archetypeManager.getEntity(entityId);
  };

  /**
   * Manually step the game simulation forward. Provide a
   * delta (in ms) of time elapsed since last frame.
   */
  step = (delta: number) => {
    this._delta = delta;
    this._phases.forEach((phase) => {
      this.emit(phase);
    });
    this.emit('preApplyOperations');
    this.flushOperations();
    this.emit('stepComplete');
  };

  enqueueOperation = (operation: Operation) => {
    this._operationQueue.push(operation);
  };

  private flushOperations = () => {
    while (this._operationQueue.length) {
      this.applyOperation(this._operationQueue.shift()!);
    }
  };

  private applyOperation = (operation: Operation) => {
    let instance: ComponentInstance<any>;
    switch (operation.op) {
      case 'addComponent':
        if (operation.entityId === 0) break;

        instance = this.componentManager.acquire(
          operation.componentType,
          operation.initialValues,
        );
        this.archetypeManager.addComponent(operation.entityId, instance);
        break;
      case 'removeComponent':
        if (operation.entityId === 0) break;

        instance = this.archetypeManager.removeComponent(
          operation.entityId,
          operation.componentType,
        );
        this.componentManager.release(instance);
        break;
      case 'createEntity':
        this.archetypeManager.createEntity(operation.entityId);
        break;
      case 'destroyEntity':
        if (operation.entityId === 0) break;

        const entity = this.archetypeManager.destroyEntity(operation.entityId);
        entity.components.forEach(this.componentManager.release);
        this.entityPool.release(entity);
        break;
      case 'markChanged':
        this.componentManager.markChanged(operation.componentId);
        break;
    }
  };
}
