import {DOMSource, VNode, makeDOMDriver, div, pre} from '@cycle/dom';
import {run} from '@cycle/run';
import {TimeSource, timeDriver} from '@cycle/time';
import xs, {Stream} from 'xstream';

type Sources = {
  DOM: DOMSource;
  Time: TimeSource;
}

type Sinks = {
  DOM: Stream<VNode>
}

type Apple = {
  kind: 'apple',
  position: Position;
}

type Tree = {
  kind: 'tree'
}

type Entity = Apple | Tree;

type State = {
  timeOfDay: number,
  agents: Agent[],
  background: Array<Array<Entity | null>>,
  width: number,
  height: number
}

type Agent = {
  kind: 'normal',
  position: Position,
  destination: Position | null,
  hunger: number,
  goal: Goal,
  plan: Plan,
  inRange: boolean
}

type EffectedStateAndAgent = {
  state: State,
  agent: Agent
}

type Position = {
  row: number;
  column: number;
}

type Effect = (state: State, agent: Agent) => EffectedStateAndAgent;
type PreconditionCheck = (state: State, agent: Agent) => boolean;
type TargetFinder = (state: State, agent: Agent) => Position;

type Action = {
  name: string;
  requiresInRange: boolean;
  findTarget: TargetFinder;
  canBePerformed: PreconditionCheck;
  effect: Effect
}

type Plan = Action[];

type Goal = {
  name: string,
  goalState: {
    [propertyToChange: string]: any
  }
}

type EmojiMap = {
  [key: string]: string
}

const emoji : EmojiMap = {
  'tree': '🌲',
  'chicken': '🐓',
  'apple': '🍎',
  'null': ' '
}

const agentEmoji : EmojiMap = {
  'full': '😋',
  'happy': '😀',
  'slightlyHappy': '🙂',
  'neutral': '😐',
  'slightlyUnhappy': '🙁',
  'unhappy': '☹️',
  'veryUnhappy': '😫'
}

function renderAgent (agent: Agent): string {
  if (agent.hunger > 95) {
    return agentEmoji.full;
  }

  if (agent.hunger > 80) {
    return agentEmoji.happy;
  }

  if (agent.hunger > 60) {
    return agentEmoji.slightlyHappy;
  }

  if (agent.hunger > 50) {
    return agentEmoji.neutral;
  }

  if (agent.hunger > 40) {
    return agentEmoji.slightlyUnhappy;
  }

  if (agent.hunger > 20) {
    return agentEmoji.unhappy;
  }

  return agentEmoji.veryUnhappy;
}

function findAgentAtPosition (state: State, position: Position): Agent | null {
  return state.agents.find(agent => agent.position.row === position.row && agent.position.column === position.column) || null;
}

function renderCell (state: State, row: number, column: number): VNode {
  const entity = state.background[row][column];
  const agent = findAgentAtPosition(state, {row, column});
  let content = '';

  if (agent) {
    content = renderAgent(agent);
  } else if (entity) {
    content = emoji[entity.kind];
  }

  return (
    div('.cell', {class: {agent}}, content)
  )
}

function renderView (state: State): VNode {
  const rows = make2dArray(state.width, state.height, (row, column) => renderCell(state, row, column))
  const brightness = Math.max(1 - Math.abs(12 - state.timeOfDay) / 12, 0.2);

  const style = {
    filter: `brightness(${brightness})`
  };

  return (
    div('.stuff', [
      div('.agents', {style}, rows.map(row => div('.row', row)))
    ])
  )
}

function goalSatisfied (agent: Agent, goal: Goal): boolean {
  let equal = true;

  Object.keys(goal.goalState).forEach(key => {
    equal = (agent as any)[key] === goal.goalState[key];
  });

  return equal;
}

function makePlan (agent: Agent, state: State, goal: Goal, actions: Action[], plan: Plan = [], depth: number = 0): Plan | null {
  if (goalSatisfied(agent, goal)) {
    return plan;
  }

  const possibleActions = actions.filter(action => action.canBePerformed(state, agent));

  if (possibleActions.length === 0 || depth > 6) {
    return null;
  }

  const allPlans = possibleActions.map(action => {
    const updatedAgentAndState = action.effect(state, agent);

    return makePlan(updatedAgentAndState.agent, updatedAgentAndState.state, goal, actions, plan.concat(action), depth + 1)
  })

  return allPlans
    .filter(plan => !!plan)
    .sort((a, b) => (a as Action[]).length - (b as Action[]).length)[0] || null;
}

function make2dArray<T> (width: number, height: number, seed: (row: number, column: number) => T): Array<Array<T>> {
  return new Array(height)
    .fill(0)
    .map((_, row) =>
      new Array(width)
        .fill(0)
        .map((_, column) => seed(row, column))
    );
}

function someTree (row: number, column: number): Entity | null {
  const random = Math.random();
  if (random > 0.95) {
    return {
      kind: 'apple',
      position: {
        row,
        column
      }
    }
  } else if (random > 0.8) {
    return {
      kind: 'tree',
      position: {
        row,
        column
      }
    }
  } else {
    return null;
  }
}

function update (state: State): State {
  // for each agent, allow the agent to update it's own state and the global state
  //
  const agents = state.agents;
  state.agents = [];

  state.timeOfDay = (state.timeOfDay + 0.2) % 24;

  return agents.reduce((currentState: State, agent: Agent) => {
    const update = produceUpdate(currentState, agent);

    return {
      ...currentState,

      ...update.state,

      agents: currentState.agents.concat(update.agent)
    }
  }, state);
}

function produceUpdate (state: State, agent: Agent): EffectedStateAndAgent {
  let newPlan = agent.plan;
  let agentUpdate : any = {hunger: agent.hunger - 0.5};

  if (agent.plan.length === 0) {
    newPlan = makePlan(agent, state, agent.goal, AllActions) || [];
    agentUpdate.plan = newPlan;
  }

  // formulate a plan
  // if we have a plan
  //  if the next action has a target
  //    set that as our target
  //  if we have a target and we aren't there
  //    move towards the target
  //  if we have arrived at the target
  //    perform the action

  const nextAction = agent.plan[0];

  if (!nextAction) {
    return {
      state,

      agent: {
        ...agent,

        ...agentUpdate
      }
    }
  }

  if (nextAction.requiresInRange && !agent.inRange) {
    if (!agent.destination) {
      return {
        state,
        agent: {
          ...agent,
          ...agentUpdate,
          destination: nextAction.findTarget(state, agent)
        }
      }
    }

    if (distance(agent.position, agent.destination) === 0) {
      return {
        state,

        agent: {
          ...agent,
          ...agentUpdate,
          destination: null,
          inRange: true
        }
      }
    }

    const movement = moveTowards(agent.position, agent.destination);

    return {
      state,

      agent: {
        ...agent,
        ...agentUpdate,
        position: add(agent.position, movement)
      }
    }
  }

  const actionEffect = nextAction.effect(state, agent);

  return {
    state: {
      ...state,
      ...actionEffect.state
    },

    agent: {
      ...agent,
      ...agentUpdate,
      ...actionEffect.agent,
      plan: agent.plan.slice(1),
      inRange: false
    }
  }
}

function sign (n: number): -1 | 0 | 1 {
  if (n < 0) {
    return -1;
  }

  if (n > 0) {
    return 1;
  }

  return 0;
}

function moveTowards (a: Position, b: Position): Position {
  return {
    row: sign(b.row - a.row),
    column: sign(b.column - a.column)
  }
}

function add (a: Position, b: Position): Position {
  return {
    row: a.row + b.row,
    column: a.column + b.column
  }
}

const AllActions = [
  {
    name: 'Eat apple',
    requiresInRange: true,
    findTarget: findApple,
    canBePerformed: (state: State, agent: Agent) => applesExistToEat(state),
    effect: (state: State, agent: Agent) => ({state: removeAdjacentApple(state, agent), agent: {...agent, hunger: 100}})
  }
]

function flatten<T> (a: Array<Array<T>>): Array<T> {
  return a.reduce((arr, cur) => arr.concat(cur), []);
}

function findApple (state: State, agent: Agent): Position {
  const apple = flatten(state.background as any)
    .filter(entity => entity && (entity as Apple).kind === 'apple')
    .sort((a: Apple, b: Apple) => distance(a.position, agent.position) - distance(b.position, agent.position))[0] as Apple

  return apple.position;
}

function applesExistToEat (state: State): boolean {
  return !!flatten(state.background).find(entity => entity ? entity.kind === 'apple' : false);
}

function removeAdjacentApple (state: State, agent: Agent): State {
  const applePositions = flatten(state.background).filter(entity => entity && entity.kind === 'apple');

  const adjacentApple = applePositions.find((apple: Apple) => {
    return distance(agent.position, apple.position) === 0;
  });

  return {
    ...state,

    background: map2dArray(state.background, (entity) => entity === adjacentApple ? null : entity)
  }
}

function map2dArray<T, U> (arr: Array<Array<T>>, f: (t: T) => U): Array<Array<U>> {
  return arr.map(row => row.map(f));
}

function distance (a: Position, b: Position): number {
  return Math.abs(a.row - b.row) + Math.abs(a.column - b.column);
}

function distanceFromAgentToApple (state: State, agent: Agent): number {
  const applePositions = flatten(state.background).filter(entity => entity && entity.kind === 'apple');

  const appleDistances = applePositions.map((apple: Apple) => {
    return distance(agent.position, apple.position);
  });

  return Math.min(...appleDistances);
}

function main (sources: Sources): Sinks {
  const initialState : State = {
    agents: [
      {
        position: {
          row: 10,
          column: 5,
        },
        destination: null,
        kind: 'normal',
        inRange: false,
        hunger: 50,
        goal: {
          name: 'Eat',

          goalState: {
            hunger: 100
          }
        },

        plan: []
      },
      /*
      {
        position: {
          row: 10,
          column: 20,
        },
        destination: null,
        kind: 'normal',
        hunger: 50,
        goal: {
          name: 'Eat',

          goalState: {
            hunger: 100
          }
        },

        plan: []
      }
      */
    ],
    background: make2dArray(60, 20, someTree),
    timeOfDay: 8,
    width: 60,
    height: 20
  }

  const update$ = sources.Time.periodic(1000 / 5);

  const state$ = update$.fold(update, initialState);

  return {
    DOM: state$.map(renderView)
  }
}

const drivers = {
  DOM: makeDOMDriver('.app'),
  Time: timeDriver
}

run(main, drivers);
