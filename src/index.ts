import {DOMSource, VNode, makeDOMDriver, div} from '@cycle/dom';
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

type Tree = {
  kind: 'tree'
}

type Chicken = {
  kind: 'chicken'
}

type Entity = Tree | Chicken;

type State = {
  agents: Agent[],
  background: Array<Array<Entity | null>>,
  width: number,
  height: number
}

type Agent = {
  kind: 'normal',
  row: number,
  column: number
}

type EmojiMap = {
  [key: string]: string
}

const emoji : EmojiMap = {
  'tree': '🌲',
  'chicken': '🐓',
  'null': ' '
}

const agentEmoji : EmojiMap = {
  'normal': '😐'
}

function findAgentAtPosition (state: State, row: number, column: number): Agent | null {
  return state.agents.find(agent => agent.row === row && agent.column === column) || null;
}

function renderCell (state: State, row: number, column: number): VNode {
  const entity = state.background[row][column];
  const agent = findAgentAtPosition(state, row, column);
  let content = '';

  if (agent) {
    content = agentEmoji[agent.kind];
  } else if (entity) {
    content = emoji[entity.kind];
  }

  return (
    div('.cell', content)
  )
}

function renderView (state: State): VNode {
  const rows = make2dArray(state.width, state.height, (row, column) => renderCell(state, row, column))

  return (
    div('.agents', rows.map(row => div('.row', row)))
  )
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
  if (random > 0.9) {
    return {
      kind: 'tree'
    }
  } else if (random > 0.88) {
    return {
      kind: 'chicken'
    }
  } else {
    return null;
  }
}

function update (state: State): State {
  return {
    ...state,

    agents: updateAgents(state.agents)
  }
}

function updateAgents (agents: Agent[]): Agent[] {
  return agents.map(updateAgent);
}

function updateAgent (agent: Agent): Agent {
  return {
    ...agent,

    column: agent.column + 1
  }
}

function main (sources: Sources): Sinks {
  const initialState : State = {
    agents: [
      {
        row: 10,
        column: 5,
        kind: 'normal'
      }
    ],
    background: make2dArray(60, 20, someTree),
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
