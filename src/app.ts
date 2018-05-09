import { DOMSource, VNode, makeDOMDriver, div, pre, strong } from "@cycle/dom";
import { run } from "@cycle/run";
import { TimeSource, timeDriver } from "@cycle/time";
import xs, { Stream } from "xstream";
import * as Heap from "qheap";

export type Sources = {
  DOM: DOMSource;
  Time: TimeSource;
};

export type Sinks = {
  DOM: Stream<VNode>;
};

export type Apple = {
  kind: "apple";
  position: Position;
};

export type Tree = {
  kind: "tree";
  position: Position;
};

export type Branch = {
  kind: "branch";
  position: Position;
};

export type Stone = {
  kind: "stone";
  position: Position;
};

export type House = {
  kind: "house";
  position: Position;
};

export type Well = {
  kind: "well";
  position: Position;
};

export type Fire = {
  kind: "fire";
  position: Position;
  life: number;
};

export type Entity = Apple | Tree | House | Branch | Stone | Well | Fire;

export type Equipment = "axe" | "rod";

export type State = {
  timeOfDay: number;
  agents: Agent[];
  background: Array<Array<Entity | null>>;
  width: number;
  height: number;
};

export type Agent = {
  id: number;
  kind: "normal";
  position: Position;
  destination: Position | null;
  alive: boolean;
  hunger: number;
  thirst: number;
  energy: number;
  social: number;
  goal: Goal;
  plan: Plan;
  holding: Equipment | null;
  hasShelter: boolean;
  shelterLocation: Position | null;
  inRange: boolean;
  inventory: Inventory;
};

export interface Inventory {
  logs: number;
  branches: number;
  stones: number;
  apples: number;
  fish: number;
  cookedFish: number;
}

export type EffectedStateAndAgent = {
  state: State;
  agent: Agent;
};

export type Position = {
  row: number;
  column: number;
};

export type Effect = (state: State, agent: Agent) => EffectedStateAndAgent;
export type PreconditionCheck = (state: State, agent: Agent) => number;
export type TargetFinder = (state: State, agent: Agent) => Position | null;

export type Action = {
  name: string;
  requiresInRange: boolean;
  range?: number;
  findTarget: TargetFinder;
  canBePerformed: PreconditionCheck;
  effect: Effect;
  cost: (state: State, agent: Agent) => number;
};

export type Plan = Action[];

export type Goal = {
  name: string;
  goalState: GoalState;
};

export type GoalState = { [propertyToChange: string]: any };

export type EmojiMap = {
  [key: string]: string;
};

const emoji: EmojiMap = {
  tree: "🌴",
  chicken: "🐓",
  apple: "🍎",
  house: "🏠",
  branch: "\\",
  stone: ".",
  well: "䷯",
  null: " ",
  fire: "🔥"
};

const agentEmoji: EmojiMap = {
  full: "😋",
  happy: "😀",
  slightlyHappy: "🙂",
  neutral: "😐",
  slightlyUnhappy: "🙁",
  unhappy: "☹️",
  veryUnhappy: "😫",
  asleep: "😴",
  eating: "😋"
};

function renderAgent(agent: Agent): string {
  if (!agent.alive) {
    return "😵";
  }

  if (
    agent.plan.length > 0 &&
    agent.plan[0].name === "Sleep at Shelter" &&
    agent.shelterLocation &&
    distance(agent.position, agent.shelterLocation) === 0
  ) {
    return agentEmoji.asleep;
  }

  if (agent.plan.length > 0 && agent.plan[0].name.indexOf("Eat") === 0) {
    return agentEmoji.eating;
  }

  const worstStat = Math.min(
    agent.hunger,
    agent.thirst,
    agent.energy,
    agent.social
  );

  if (worstStat > 95) {
    return agentEmoji.full;
  }

  if (worstStat > 80) {
    return agentEmoji.happy;
  }

  if (worstStat > 60) {
    return agentEmoji.slightlyHappy;
  }

  if (worstStat > 50) {
    return agentEmoji.neutral;
  }

  if (worstStat > 40) {
    return agentEmoji.slightlyUnhappy;
  }

  if (worstStat > 20) {
    return agentEmoji.unhappy;
  }

  return agentEmoji.veryUnhappy;
}

function findAgentAtPosition(state: State, position: Position): Agent | null {
  return (
    state.agents.find(
      agent =>
        agent.position.row === position.row &&
        agent.position.column === position.column
    ) || null
  );
}

function renderCell(state: State, row: number, column: number): VNode {
  const entity = state.background[row][column];
  const agent = findAgentAtPosition(state, { row, column });
  let content = "";

  if (agent) {
    content = renderAgent(agent);
  } else if (entity) {
    content = emoji[entity.kind];
  }
  let target;

  return div(
    ".cell",
    {
      class: {
        sand: isSand(row, column),
        [(entity && entity.kind) || "blank"]: true,
        agent,
        axe: agent && agent.holding === "axe",
        rod: agent && agent.holding === "rod",
        fish: agent && agent.inventory.fish > 0,
        talking:
          agent &&
          agent.plan.length > 0 &&
          agent.plan[0].name === "Chat" &&
          (target = agent.plan[0].findTarget(state, agent)) &&
          distance(agent.position, target) <= 1
      }
    },
    content
  );
}

function renderView(state: State): VNode {
  const rows = make2dArray(state.width, state.height, (row, column) =>
    renderCell(state, row, column)
  );
  const brightness = Math.max(1 - Math.abs(12 - state.timeOfDay) / 12, 0.2);

  const style = {
    filter: `brightness(${brightness})`
  };

  return div(".stuff", { style }, [
    /*div(".plan", [
      strong(state.agents[0].goal.name),
      ...state.agents[0].plan.map(action => action.name).map(name => div(name)),
      div(`Hunger: ${state.agents[0].hunger}`),
      div(`Thirst: ${state.agents[0].thirst}`),
      div(`Energy: ${state.agents[0].energy}`),
      div(`Shelter: ${state.agents[0].hasShelter}`)
    ]),*/
    div(".agents", rows.map((row, r) => div(".row", row)))
  ]);
}

export function goalSatisfied(agent: Agent, goal: Goal): boolean {
  let satisfied = true;

  Object.keys(goal.goalState).forEach(key => {
    if (typeof (agent as any)[key] === "number") {
      satisfied = (agent as any)[key] >= goal.goalState[key];
    } else {
      satisfied = (agent as any)[key] === goal.goalState[key];
    }
  });

  return satisfied;
}

function findGoal(agent: Agent): Goal {
  if (agent.energy < 60) {
    return {
      name: "Sleep",

      goalState: {
        energy: 100
      }
    };
  }

  if (agent.thirst < 70) {
    return {
      name: "Drink",

      goalState: {
        thirst: 100
      }
    };
  }

  if (agent.hunger < 50) {
    return {
      name: "Eat",

      goalState: {
        hunger: 80
      }
    };
  }

  if (!agent.hasShelter) {
    return {
      name: "Build Shelter",

      goalState: {
        hasShelter: true
      }
    };
  }

  if (agent.social < 60) {
    return {
      name: "Talk",

      goalState: {
        social: 80
      }
    };
  }

  return {
    name: "Eat",
    goalState: {
      hunger: 100
    }
  };
}

interface Solution {
  nextSteps: Solution | null;
  toPerform: Action | null;
  actions: Action[];
}

function solutionToActions(solution: Solution): Action[] {
  if (solution.nextSteps === null) {
    return solution.actions;
  }

  return solution.actions.concat(solutionToActions(solution.nextSteps));
}

function printSolution(solution: Solution): string {
  if (solution.nextSteps === null) {
    return solution.actions.map(a => a.name).join("\n");
  }

  return (
    solution.actions.map(a => a.name).join("\n") +
    "\n" +
    printSolution(solution.nextSteps)
  );
}

function applyActions(
  actions: Action[],
  current: { state: State; agent: Agent },
  strict = false
) {
  for (const action of actions) {
    if (strict && action.canBePerformed(current.state, current.agent) !== 0) {
      break;
    }

    current = action.effect(current.state, current.agent);
  }

  return current;
}

function cost(solution: Solution, state: State, agent: Agent): number {
  if (solution.nextSteps === null) {
    return solution.actions
      .map(a => a.cost(state, agent))
      .reduce((acc, val) => acc + val, 0);
  }

  return (
    solution.actions
      .map(a => a.cost(state, agent))
      .reduce((acc, val) => acc + val, 0) +
    cost(solution.nextSteps, state, agent)
  );
}

export function makePlanBetter(
  agent: Agent,
  state: State,
  goal: Goal
): Plan | null {
  const isSolution = (solution: Solution) => {
    const actions = solutionToActions(solution);
    let outcome = applyActions(actions, { agent, state }, true);

    return goalDistance(outcome.state, outcome.agent, goal.goalState) === 0;
  };

  let solutionQueue = new Heap({
    comparBefore: (a: Solution, b: Solution) =>
      cost(a, state, agent) < cost(b, state, agent)
  });

  solutionQueue.insert({
    nextSteps: null,
    actions: [],
    toPerform: null,
    cost: 0
  });

  let solution: Solution | undefined;

  while ((solution = solutionQueue.shift()) && !isSolution(solution)) {
    const { nextSteps, actions } = solution as Solution;

    let check;

    if (nextSteps === null) {
      check = (state: State, agent: Agent) =>
        goalDistance(state, agent, goal.goalState);
    } else {
      check = (state: State, agent: Agent) =>
        (solution as any).toPerform.canBePerformed(state, agent);
    }

    const statesWithActions = applyActions(actions, { state, agent });
    const distance = check(statesWithActions.state, statesWithActions.agent);

    for (const action of AllActions) {
      const newPlan = [action].concat(actions);

      const updatedStateAndAgent = applyActions(newPlan, { state, agent });

      const updatedDistance = check(
        updatedStateAndAgent.state,
        updatedStateAndAgent.agent
      );

      const delta = distance - updatedDistance;

      if (delta > 0 && updatedDistance === 0) {
        solutionQueue.insert({
          nextSteps: { ...solution, actions: newPlan },
          toPerform: action,
          actions: []
        });
      } else if (delta > 0) {
        solutionQueue.push({ ...solution, actions: newPlan });
      }
    }
  }

  if (solution && isSolution(solution)) {
    return solutionToActions(solution);
  }

  return null;
}

function make2dArray<T>(
  width: number,
  height: number,
  seed: (row: number, column: number) => T
): Array<Array<T>> {
  return new Array(height)
    .fill(0)
    .map((_, row) =>
      new Array(width).fill(0).map((_, column) => seed(row, column))
    );
}

function isSand(row: number, column: number): boolean {
  return row === 0 || row === 19 || column === 0 || column === 59;
}

function someTree(row: number, column: number): Entity | null {
  const random = Math.random();
  const sand = isSand(row, column);

  if (random > 0.98 && !sand) {
    return {
      kind: "apple",
      position: {
        row,
        column
      }
    };
  } else if (random > 0.95 && !sand) {
    return {
      kind: "tree",
      position: {
        row,
        column
      }
    };
  } else if (random > 0.9) {
    return {
      kind: "branch",
      position: {
        row,
        column
      }
    };
  } else if (random > 0.85) {
    return {
      kind: "stone",
      position: {
        row,
        column
      }
    };
  } else {
    return null;
  }
}

function update(state: State): State {
  // for each agent, allow the agent to update it's own state and the global state
  //
  const agents = state.agents;

  state.timeOfDay = (state.timeOfDay + 0.1) % 24;

  state = agents.reduce((currentState: State, agent: Agent) => {
    const update = produceUpdate(currentState, agent);

    return {
      ...currentState,

      ...update.state,

      agents: currentState.agents.map(
        a => (a.id === update.agent.id ? update.agent : a)
      )
    };
  }, state);

  state = {
    ...state,
    background: map2dArray(state.background, (e: Entity) => {
      if (e && e.kind === "fire") {
        const newLife = e.life - 1;

        if (newLife <= 0) {
          return null;
        }

        return {
          ...e,
          life: newLife
        };
      }

      return e;
    })
  };

  return state;
}

function dayTime(timeOfDay: number): boolean {
  return timeOfDay > 7 && timeOfDay < 20;
}

function goalDistance(
  state: State,
  agent: Agent,
  goalState: GoalState
): number {
  let distance = 0;

  for (const key of Object.keys(goalState)) {
    const agentValue = (agent as any)[key];
    const goalValue = goalState[key];

    if (key === "inventory") {
      for (const inventoryKey of Object.keys(goalState[key])) {
        const agentInventoryValue = (agent.inventory as any)[inventoryKey];
        const goalStateInventoryValue = (goalState.inventory as any)[
          inventoryKey
        ];

        distance += Math.abs(goalStateInventoryValue - agentInventoryValue);
      }

      continue;
    }

    if (key === "holding") {
      distance += agent.holding === goalState.holding ? 0 : 1;

      continue;
    }

    if (typeof goalValue === "number") {
      if (agentValue >= goalValue) {
        return 0;
      }
      distance += Math.abs(goalValue - agentValue) / 100;
    }

    if (typeof goalValue === "boolean") {
      distance += goalValue == agentValue ? 0 : 1;
    }
  }

  return distance;
}

function stateDelta(
  state: State,
  agent: Agent,
  goalState: GoalState
): GoalState {
  let output: GoalState = {};

  for (const key of Object.keys(goalState)) {
    const agentValue = (agent as any)[key];
    const goalValue = goalState[key];

    if (key === "inventory") {
      output.inventory = {};

      for (const inventoryKey of Object.keys(goalState[key])) {
        const agentInventoryValue = (agent.inventory as any)[inventoryKey];
        const goalStateInventoryValue = (goalState.inventory as any)[
          inventoryKey
        ];

        const difference = goalStateInventoryValue - agentInventoryValue;
        if (difference !== 0) {
          output.inventory[inventoryKey] = difference;
        }
      }

      continue;
    }

    if (key === "holding") {
      if (agent[key] !== goalState[key]) {
        output["holding"] = goalState.holding;
      }

      continue;
    }

    if (typeof goalValue === "number") {
      const difference = Math.abs(goalValue - agentValue) / 100;
      if (difference !== 0) {
        output[key] = difference;
      }
    }

    if (typeof goalValue === "boolean") {
      const difference = goalValue == agentValue ? 0 : 1;
      if (difference !== 0) {
        output[key] = difference;
      }
    }
  }

  return output;
}

function produceUpdate(state: State, agent: Agent): EffectedStateAndAgent {
  if (!agent.alive) {
    return { state, agent };
  }

  if (
    agent.thirst <= 0 ||
    agent.hunger <= 0 ||
    agent.energy <= 0 ||
    agent.social <= 0
  ) {
    return {
      state,
      agent: {
        ...agent,
        alive: false
      }
    };
  }

  let newPlan = agent.plan;
  let agentUpdate: any = {
    hunger: agent.hunger - 0.2,
    thirst: agent.thirst - 0.5,
    energy: agent.energy - (dayTime(state.timeOfDay) ? 0.2 : 0.5),
    social: agent.social - 0.2
  };
  let goal = agent.goal;

  if (goalSatisfied(agent, goal)) {
    goal = findGoal(agent);
    agent.goal = goal;
    agentUpdate.goal = goal;
  }

  if (agent.plan.length === 0) {
    newPlan = makePlanBetter(agent, state, goal) || [];
    if (newPlan.length == 0) {
      goal = findGoal(agent);
      agent.goal = goal;
      agentUpdate.goal = goal;
      newPlan = makePlanBetter(agent, state, goal) || [];
      console.log("could not find a plan for", goal.name);
    }
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
    };
  }

  if (nextAction.requiresInRange) {
    let nextDestination = nextAction.findTarget(state, agent);

    if (!nextDestination) {
      return {
        state,
        agent: {
          ...agent,
          ...agentUpdate,
          plan: []
        }
      };
    }

    if (distance(agent.position, nextDestination) > (nextAction.range || 0)) {
      const movement = moveTowards(agent.position, nextDestination);

      return {
        state,

        agent: {
          ...agent,
          ...agentUpdate,
          position: add(agent.position, movement)
        }
      };
    }
  }

  if (nextAction.canBePerformed(state, agent) === 0) {
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
        plan: agent.plan.slice(1)
      }
    };
  }
  {
    return {
      state,

      agent: {
        ...agent,
        ...agentUpdate,
        plan: []
      }
    };
  }
}

function sign(n: number): -1 | 0 | 1 {
  if (n < 0) {
    return -1;
  }

  if (n > 0) {
    return 1;
  }

  return 0;
}

function moveTowards(a: Position, b: Position): Position {
  return {
    row: sign(b.row - a.row),
    column: sign(b.column - a.column)
  };
}

function add(a: Position, b: Position): Position {
  return {
    row: a.row + b.row,
    column: a.column + b.column
  };
}

export const AllActions: Action[] = [
  {
    name: "Eat apple",
    requiresInRange: false,
    findTarget: () => ({ row: 0, column: 0 }),
    canBePerformed: has("apples", 1),
    effect: (state: State, agent: Agent) => ({
      state,
      agent: {
        ...agent,
        hunger: 100,
        inventory: { ...agent.inventory, apples: agent.inventory.apples - 1 }
      }
    }),
    cost: () => 1
  },
  {
    name: "Pick up apple",
    requiresInRange: true,
    range: 1,
    findTarget: find("apple"),
    canBePerformed: entityExists("apple"),
    effect: (state: State, agent: Agent) => ({
      state: removeAdjacent(state, agent, "apple"),
      agent: {
        ...agent,
        inventory: { ...agent.inventory, apples: agent.inventory.apples + 1 }
      }
    }),
    cost: entityDistance("apple")
  },
  {
    name: "Build Shelter",
    requiresInRange: false,
    canBePerformed: has("logs", 2),
    findTarget: () => ({ row: 0, column: 0 }),
    effect: (state: State, agent: Agent) => ({
      state: build("house", state, agent),
      agent: {
        ...agent,
        hasShelter: true,
        shelterLocation: {
          row: agent.position.row - 1,
          column: agent.position.column
        },
        inventory: { ...agent.inventory, logs: agent.inventory.logs - 2 }
      }
    }),
    cost: () => 1
  },
  {
    name: "Build Well",
    requiresInRange: false,
    canBePerformed: has("stones", 2),
    findTarget: () => ({ row: 0, column: 0 }),
    effect: (state: State, agent: Agent) => ({
      state: build("well", state, agent),
      agent: {
        ...agent,
        inventory: { ...agent.inventory, stones: agent.inventory.stones - 2 }
      }
    }),
    cost: () => 1
  },
  {
    name: "Fell Tree",
    requiresInRange: true,
    range: 1,
    findTarget: find("tree"),
    canBePerformed: both(holding("axe"), entityExists("tree")),
    effect: (state: State, agent: Agent) => ({
      state: removeAdjacent(state, agent, "tree"),
      agent: {
        ...agent,
        inventory: { ...agent.inventory, logs: agent.inventory.logs + 1 }
      }
    }),
    cost: entityDistance("tree")
  },
  {
    name: "Make Axe",
    requiresInRange: false,
    findTarget: () => ({ row: 0, column: 0 }),
    canBePerformed: both(has("stones", 1), has("branches", 1)),
    effect: (state: State, agent: Agent) => ({
      state,
      agent: {
        ...agent,

        holding: "axe",

        inventory: {
          ...agent.inventory,
          stones: agent.inventory.stones - 1,
          branches: agent.inventory.branches - 1
        }
      }
    }),
    cost: () => 1
  },
  {
    name: "Gather Stone",
    requiresInRange: true,
    range: 1,
    findTarget: find("stone"),
    canBePerformed: entityExists("stone"),
    effect: (state: State, agent: Agent) => ({
      state: removeAdjacent(state, agent, "stone"),
      agent: {
        ...agent,
        inventory: addToInventory(agent.inventory, "stones", 1)
      }
    }),
    cost: entityDistance("stone")
  },
  {
    name: "Gather Branch",
    requiresInRange: true,
    range: 1,
    findTarget: find("branch"),
    canBePerformed: entityExists("branch"),
    effect: (state: State, agent: Agent) => ({
      state: removeAdjacent(state, agent, "branch"),
      agent: {
        ...agent,
        inventory: addToInventory(agent.inventory, "branches", 1)
      }
    }),
    cost: entityDistance("branch")
  },
  {
    name: "Drink from Well",
    requiresInRange: true,
    range: 1,
    findTarget: find("well"),
    canBePerformed: entityExists("well"),
    effect: (state: State, agent: Agent) => ({
      state,
      agent: { ...agent, thirst: 100 }
    }),
    cost: entityDistance("well")
  },
  {
    name: "Sleep at Shelter",
    requiresInRange: true,
    findTarget: (state, agent) => agent.shelterLocation as Position,
    canBePerformed: (state, agent) => (agent.hasShelter ? 0 : 1),
    effect: (state: State, agent: Agent) => ({
      state,
      agent: { ...agent, energy: agent.energy + 10 }
    }),
    cost: entityDistance("shelter")
  },
  {
    name: "Eat Cooked Fish",
    requiresInRange: false,
    findTarget: () => ({ row: 0, column: 0 }),
    canBePerformed: has("cookedFish", 1),
    effect: (state: State, agent: Agent) => ({
      state,
      agent: {
        ...agent,
        hunger: 100,
        inventory: {
          ...agent.inventory,
          cookedFish: agent.inventory.cookedFish - 1
        }
      }
    }),
    cost: () => 1
  },
  {
    name: "Cook Fish",
    requiresInRange: true,
    range: 1,
    findTarget: find("fire"),
    canBePerformed: both(entityExists("fire"), has("fish", 1)),
    effect: (state: State, agent: Agent) => ({
      state,
      agent: {
        ...agent,
        inventory: {
          ...agent.inventory,
          fish: agent.inventory.fish - 1,
          cookedFish: agent.inventory.cookedFish + 1
        }
      }
    }),
    cost: () => 1
  },
  {
    name: "Light Fire",
    requiresInRange: false,
    findTarget: () => ({ row: 0, column: 0 }),
    canBePerformed: has("branches", 1),
    effect: (state: State, agent: Agent) => ({
      state: build("fire", state, agent),
      agent: {
        ...agent,
        inventory: {
          ...agent.inventory,
          branches: agent.inventory.branches - 1
        }
      }
    }),
    cost: () => 1
  },
  {
    name: "Catch Fish",
    requiresInRange: true,
    findTarget: nearestCoastTile,
    canBePerformed: holding("rod"),
    effect: (state: State, agent: Agent) => ({
      state,
      agent: {
        ...agent,
        inventory: { ...agent.inventory, fish: agent.inventory.fish + 1 }
      }
    }),
    cost: () => 1
  },
  {
    name: "Make Rod",
    requiresInRange: false,
    findTarget: () => ({ row: 0, column: 0 }),
    canBePerformed: both(holding(null), has("branches", 1)),
    effect: (state: State, agent: Agent) => ({
      state,
      agent: {
        ...agent,
        holding: "rod"
      }
    }),
    cost: () => 1
  },
  {
    name: "Put down equipment",
    requiresInRange: false,
    findTarget: () => ({ row: 0, column: 0 }),
    canBePerformed: either(holding("rod"), holding("axe")),
    effect: (state: State, agent: Agent) => ({
      state,
      agent: {
        ...agent,
        holding: null
      }
    }),
    cost: () => 1
  },
  {
    name: "Chat",
    requiresInRange: true,
    range: 1,
    findTarget: findOtherAgent,
    canBePerformed: otherAgentExists,
    effect: (state: State, agent: Agent) => ({
      state,
      agent: {
        ...agent,
        social: agent.social + 20
      }
    }),
    cost: () => 1
  }
];

function nearestCoastTile(state: State, agent: Agent): Position {
  const possibilities = [
    { row: 0, column: agent.position.column },
    { row: 19, column: agent.position.column },
    { row: agent.position.row, column: 0 },
    { row: agent.position.row, column: 59 }
  ];

  return possibilities.sort(
    (a, b) => distance(a, agent.position) - distance(b, agent.position)
  )[0];
}

function flatten<T>(a: Array<Array<T>>): Array<T> {
  return Array.prototype.concat.apply([], a);
}

function entityDistance(type: string): (state: State, agent: Agent) => number {
  return function(state: State, agent: Agent): number {
    let entity = find(type)(state, agent);

    if (!entity) {
      return Infinity;
    }

    return distance(entity, agent.position);
  };
}

function find(type: string): (state: State, agent: Agent) => Position | null {
  return function(state: State, agent: Agent): Position | null {
    const apple = flatten(state.background as any)
      .filter(entity => entity && (entity as Apple).kind === type)
      .sort(
        (a: Apple, b: Apple) =>
          distance(a.position, agent.position) -
          distance(b.position, agent.position)
      )[0] as Apple;

    if (apple) {
      return apple.position;
    } else {
      return null;
    }
  };
}

function findOtherAgent(state: State, agent: Agent): Position | null {
  const otherAgent = state.agents
    .filter(a => a.id !== agent.id)
    .sort(
      (a, b) =>
        distance(a.position, agent.position) -
        distance(b.position, agent.position)
    )[0];

  if (otherAgent) {
    return otherAgent.position;
  }

  return null;
}

function otherAgentExists(state: State, agent: Agent): number {
  return state.agents.find(a => a.id !== agent.id) ? 0 : 1;
}

type StateCheck = (state: State, agent: Agent) => boolean;

function both(a: PreconditionCheck, b: PreconditionCheck): PreconditionCheck {
  return function(state: State, agent: Agent): number {
    return a(state, agent) + b(state, agent);
  };
}

function either(a: PreconditionCheck, b: PreconditionCheck): PreconditionCheck {
  return function(state: State, agent: Agent): number {
    return a(state, agent) === 0 || b(state, agent) === 0 ? 0 : 1;
  };
}

function holding(kind: string | null): PreconditionCheck {
  return function(_: State, agent: Agent): number {
    return agent.holding === kind ? 0 : 1;
  };
}

function entityExists(type: string): (state: State) => number {
  return function(state: State): number {
    return !!flatten(state.background).find(
      entity => (entity ? entity.kind === type : false)
    )
      ? 0
      : 1;
  };
}

function build(type: string, state: State, agent: Agent): State {
  const house: any = {
    kind: type,
    position: {
      row: agent.position.row - 1,
      column: agent.position.column
    }
  };

  if (type === "fire") {
    house.life = 30;
  }

  return {
    ...state,

    background: map2dArray(
      state.background,
      (entity: Entity, position: Position): Entity =>
        position.row === agent.position.row - 1 &&
        position.column === agent.position.column
          ? house
          : entity
    )
  };
}

function removeAdjacent(state: State, agent: Agent, type: string): State {
  const applePositions = flatten(state.background).filter(
    entity => entity && entity.kind === type
  );

  const adjacentApple = applePositions.find((apple: Apple) => {
    return distance(agent.position, apple.position) <= 1;
  });

  return {
    ...state,

    background: map2dArray(
      state.background,
      entity => (entity === adjacentApple ? null : entity)
    )
  };
}

function has(type: string, quantity: number): PreconditionCheck {
  return function(state: State, agent: Agent): number {
    const difference = quantity - Math.max(0, (agent.inventory as any)[type]);

    if (difference <= 0) {
      return 0;
    } else {
      return difference;
    }
  };
}

function addToInventory(
  inventory: Inventory,
  type: string,
  amount: number
): Inventory {
  return {
    ...inventory,
    [type]: (inventory as any)[type] + amount
  } as Inventory;
}

function map2dArray<T, U>(
  arr: Array<Array<T>>,
  f: (t: T, p?: Position) => U
): Array<Array<U>> {
  return arr.map((row, r) =>
    row.map((cell, c) => f(cell, { row: r, column: c }))
  );
}

function distance(a: Position, b: Position): number {
  return Math.abs(a.row - b.row) + Math.abs(a.column - b.column);
}

export const initialState: State = {
  agents: [
    {
      position: {
        row: 10,
        column: 5
      },
      destination: null,
      id: 1,
      kind: "normal",
      inRange: false,
      alive: true,
      hunger: 50 + Math.random() * 50,
      thirst: 50 + Math.random() * 50,
      social: 50 + Math.random() * 50,
      energy: 90,
      hasShelter: false,
      shelterLocation: null,
      holding: null,
      goal: {
        name: "Eat",

        goalState: {
          hunger: 100
        }
      },
      inventory: {
        logs: 0,
        branches: 0,
        apples: 0,
        stones: 0,
        fish: 0,
        cookedFish: 0
      },

      plan: []
    },
    {
      position: {
        row: 10,
        column: 15
      },
      destination: null,
      id: 2,
      kind: "normal",
      inRange: false,
      alive: true,
      hunger: 50 + Math.random() * 50,
      thirst: 50 + Math.random() * 50,
      social: 50 + Math.random() * 50,
      energy: 90,
      hasShelter: false,
      shelterLocation: null,
      holding: null,
      goal: {
        name: "Eat",

        goalState: {
          hunger: 100
        }
      },
      inventory: {
        logs: 0,
        branches: 0,
        apples: 0,
        stones: 0,
        fish: 0,
        cookedFish: 0
      },

      plan: []
    },
    {
      position: {
        row: 3,
        column: 30
      },
      destination: null,
      id: 3,
      kind: "normal",
      inRange: false,
      alive: true,
      hunger: 50 + Math.random() * 50,
      thirst: 50 + Math.random() * 50,
      social: 50 + Math.random() * 50,
      energy: 90,
      hasShelter: false,
      shelterLocation: null,
      holding: null,
      goal: {
        name: "Eat",

        goalState: {
          hunger: 100
        }
      },
      inventory: {
        logs: 0,
        branches: 0,
        stones: 0,
        apples: 0,
        fish: 0,
        cookedFish: 0
      },

      plan: []
    },
    {
      position: {
        row: 10,
        column: 55
      },
      destination: null,
      id: 4,
      kind: "normal",
      inRange: false,
      alive: true,
      hunger: 50 + Math.random() * 50,
      thirst: 50 + Math.random() * 50,
      social: 50 + Math.random() * 50,
      energy: 90,
      hasShelter: false,
      shelterLocation: null,
      holding: null,
      goal: {
        name: "Eat",

        goalState: {
          hunger: 100
        }
      },
      inventory: {
        logs: 0,
        branches: 0,
        stones: 0,
        apples: 0,
        fish: 0,
        cookedFish: 0
      },

      plan: []
    }

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
};
export function main(sources: Sources): Sinks {
  const update$ = sources.Time.periodic(1000 / 5);

  const state$ = update$.fold(update, initialState);

  return {
    DOM: state$.map(renderView)
  };
}
