import { DOMSource, VNode, makeDOMDriver, div, pre, strong } from "@cycle/dom";
import { run } from "@cycle/run";
import { TimeSource, timeDriver } from "@cycle/time";
import xs, { Stream } from "xstream";

type Sources = {
  DOM: DOMSource;
  Time: TimeSource;
};

type Sinks = {
  DOM: Stream<VNode>;
};

type Apple = {
  kind: "apple";
  position: Position;
};

type Tree = {
  kind: "tree";
  position: Position;
};

type Branch = {
  kind: "branch";
  position: Position;
};

type Stone = {
  kind: "stone";
  position: Position;
};

type House = {
  kind: "house";
  position: Position;
};

type Well = {
  kind: "well";
  position: Position;
};

type Entity = Apple | Tree | House | Branch | Stone | Well;

type Axe = {
  kind: "axe";
};

type Equipment = Axe;

type State = {
  timeOfDay: number;
  agents: Agent[];
  background: Array<Array<Entity | null>>;
  width: number;
  height: number;
};

type Agent = {
  kind: "normal";
  position: Position;
  destination: Position | null;
  hunger: number;
  thirst: number;
  energy: number;
  goal: Goal;
  plan: Plan;
  holding: Equipment | null;
  hasShelter: boolean;
  shelterLocation: Position | null;
  inRange: boolean;
  inventory: Inventory;
};

interface Inventory {
  logs: number;
  branches: number;
  stones: number;
}

type EffectedStateAndAgent = {
  state: State;
  agent: Agent;
};

type Position = {
  row: number;
  column: number;
};

type Effect = (state: State, agent: Agent) => EffectedStateAndAgent;
type PreconditionCheck = (state: State, agent: Agent) => boolean;
type TargetFinder = (state: State, agent: Agent) => Position;

type Action = {
  name: string;
  requiresInRange: boolean;
  findTarget: TargetFinder;
  canBePerformed: PreconditionCheck;
  effect: Effect;
};

type Plan = Action[];

type Goal = {
  name: string;
  goalState: {
    [propertyToChange: string]: any;
  };
};

type EmojiMap = {
  [key: string]: string;
};

const emoji: EmojiMap = {
  tree: "🌲",
  chicken: "🐓",
  apple: "🍎",
  house: "🏠",
  branch: "\\",
  stone: ".",
  well: "䷯",
  null: " "
};

const agentEmoji: EmojiMap = {
  full: "😋",
  happy: "😀",
  slightlyHappy: "🙂",
  neutral: "😐",
  slightlyUnhappy: "🙁",
  unhappy: "☹️",
  veryUnhappy: "😫"
};

function renderAgent(agent: Agent): string {
  const worstStat = Math.min(agent.hunger, agent.thirst);

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

  return div(
    ".cell",
    {
      class: {
        agent,
        axe: agent && agent.holding && agent.holding.kind === "axe"
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

  return div(".stuff", [
    div(".plan", [
      strong(state.agents[0].goal.name),
      ...state.agents[0].plan.map(action => action.name).map(name => div(name)),
      div(`Hunger: ${state.agents[0].hunger}`),
      div(`Thirst: ${state.agents[0].thirst}`),
      div(`Energy: ${state.agents[0].energy}`),
      div(`Shelter: ${state.agents[0].hasShelter}`)
    ]),
    div(".agents", { style }, rows.map(row => div(".row", row)))
  ]);
}

function goalSatisfied(agent: Agent, goal: Goal): boolean {
  let satisfied = true;

  Object.keys(goal.goalState).forEach(key => {
    if (typeof (agent as any)[key] === 'number') {
      satisfied = (agent as any)[key] >= goal.goalState[key];
    } else {
      satisfied = (agent as any)[key] === goal.goalState[key];
    }
  });

  return satisfied;
}

function findGoal(agent: Agent): Goal {
  if (agent.energy < 50) {
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

  return {
    name: "Eat",
    goalState: {
      hunger: 100
    }
  };
}

function makePlan(
  agent: Agent,
  state: State,
  goal: Goal,
  actions: Action[],
  plan: Plan = [],
  depth: number = 0
): Plan | null {
  if (goalSatisfied(agent, goal)) {
    return plan;
  }

  const possibleActions = actions.filter(action =>
    action.canBePerformed(state, agent)
  );

  if (possibleActions.length === 0 || depth > 6) {
    return null;
  }

  const allPlans = possibleActions.map(action => {
    const updatedAgentAndState = action.effect(state, agent);

    return makePlan(
      updatedAgentAndState.agent,
      updatedAgentAndState.state,
      goal,
      actions,
      plan.concat(action),
      depth + 1
    );
  });

  return (
    allPlans
      .filter(plan => !!plan)
      .sort((a, b) => (a as Action[]).length - (b as Action[]).length)[0] ||
    null
  );
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

function someTree(row: number, column: number): Entity | null {
  const random = Math.random();
  if (random > 0.95) {
    return {
      kind: "apple",
      position: {
        row,
        column
      }
    };
  } else if (random > 0.8) {
    return {
      kind: "tree",
      position: {
        row,
        column
      }
    };
  } else if (random > 0.75) {
    return {
      kind: "branch",
      position: {
        row,
        column
      }
    };
  } else if (random > 0.7) {
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
  state.agents = [];

  state.timeOfDay = (state.timeOfDay + 0.2) % 24;

  return agents.reduce((currentState: State, agent: Agent) => {
    const update = produceUpdate(currentState, agent);

    return {
      ...currentState,

      ...update.state,

      agents: currentState.agents.concat(update.agent)
    };
  }, state);
}

function dayTime(timeOfDay:number): boolean {
  return timeOfDay > 7 && timeOfDay < 20;
}

function produceUpdate(state: State, agent: Agent): EffectedStateAndAgent {
  let newPlan = agent.plan;
  let agentUpdate: any = {
    hunger: agent.hunger - 0.5,
    thirst: agent.thirst - 1,
    energy: agent.energy - (dayTime(state.timeOfDay) ? 0.5 : 1)
  };
  let goal = agent.goal;

  if (goalSatisfied(agent, goal)) {
    goal = findGoal(agent);
    agent.goal = goal;
    agentUpdate.goal = goal;
  }

  if (agent.plan.length === 0) {
    newPlan = makePlan(agent, state, goal, AllActions) || [];
    if (newPlan.length == 0) {
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

  if (nextAction.requiresInRange && !agent.inRange) {
    if (!agent.destination) {
      return {
        state,
        agent: {
          ...agent,
          ...agentUpdate,
          destination: nextAction.findTarget(state, agent)
        }
      };
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
      };
    }

    const movement = moveTowards(agent.position, agent.destination);

    return {
      state,

      agent: {
        ...agent,
        ...agentUpdate,
        position: add(agent.position, movement)
      }
    };
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
  };
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

const AllActions: Action[] = [
  {
    name: "Eat apple",
    requiresInRange: true,
    findTarget: find("apple"),
    canBePerformed: entityExists("apple"),
    effect: (state: State, agent: Agent) => ({
      state: removeAdjacent(state, agent, "apple"),
      agent: { ...agent, hunger: 100 }
    })
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
        shelterLocation: {row: agent.position.row - 1, column: agent.position.column},
        inventory: { ...agent.inventory, logs: agent.inventory.logs - 2 }
      }
    })
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
    })
  },
  {
    name: "Fell Tree",
    requiresInRange: true,
    findTarget: find("tree"),
    canBePerformed: both(holding("axe"), entityExists("tree")),
    effect: (state: State, agent: Agent) => ({
      state: removeAdjacent(state, agent, "tree"),
      agent: {
        ...agent,
        inventory: { ...agent.inventory, logs: agent.inventory.logs + 1 }
      }
    })
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

        holding: {
          kind: "axe"
        } as Axe,

        inventory: {
          ...agent.inventory,
          stones: agent.inventory.stones - 1,
          branches: agent.inventory.branches - 1
        }
      }
    })
  },
  {
    name: "Gather Stone",
    requiresInRange: true,
    findTarget: find("stone"),
    canBePerformed: entityExists("stone"),
    effect: (state: State, agent: Agent) => ({
      state: removeAdjacent(state, agent, "stone"),
      agent: {
        ...agent,
        inventory: addToInventory(agent.inventory, "stones", 1)
      }
    })
  },
  {
    name: "Gather Branch",
    requiresInRange: true,
    findTarget: find("branch"),
    canBePerformed: entityExists("branch"),
    effect: (state: State, agent: Agent) => ({
      state: removeAdjacent(state, agent, "branch"),
      agent: {
        ...agent,
        inventory: addToInventory(agent.inventory, "branches", 1)
      }
    })
  },
  {
    name: "Drink from Well",
    requiresInRange: true,
    findTarget: find("well"),
    canBePerformed: entityExists("well"),
    effect: (state: State, agent: Agent) => ({
      state,
      agent: { ...agent, thirst: 100 }
    })
  },
  {
    name: "Sleep at Shelter",
    requiresInRange: true,
    findTarget: (state, agent) => agent.shelterLocation as Position,
    canBePerformed: (state, agent) => agent.hasShelter,
    effect: (state: State, agent: Agent) => ({
      state,
      agent: { ...agent, energy: agent.energy + 25 }
    })
  }
];

function flatten<T>(a: Array<Array<T>>): Array<T> {
  return Array.prototype.concat.apply([], a);
}

function find(type: string): (state: State, agent: Agent) => Position {
  return function(state: State, agent: Agent): Position {
    const apple = flatten(state.background as any)
      .filter(entity => entity && (entity as Apple).kind === type)
      .sort(
        (a: Apple, b: Apple) =>
          distance(a.position, agent.position) -
          distance(b.position, agent.position)
      )[0] as Apple;

    return apple.position;
  };
}

type StateCheck = (state: State, agent: Agent) => boolean;

function both(a: StateCheck, b: StateCheck): StateCheck {
  return function(state: State, agent: Agent): boolean {
    return a(state, agent) && b(state, agent);
  };
}

function holding(kind: string): StateCheck {
  return function(_: State, agent: Agent): boolean {
    return !!agent.holding && agent.holding.kind === kind;
  };
}

function entityExists(type: string): (state: State) => boolean {
  return function(state: State) {
    return !!flatten(state.background).find(
      entity => (entity ? entity.kind === type : false)
    );
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
    return distance(agent.position, apple.position) === 0;
  });

  return {
    ...state,

    background: map2dArray(
      state.background,
      entity => (entity === adjacentApple ? null : entity)
    )
  };
}

function has(type: string, quantity: number): StateCheck {
  return function(state: State, agent: Agent): boolean {
    return (agent.inventory as any)[type] >= quantity;
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

function main(sources: Sources): Sinks {
  const initialState: State = {
    agents: [
      {
        position: {
          row: 10,
          column: 5
        },
        destination: null,
        kind: "normal",
        inRange: false,
        hunger: 50 + Math.random() * 50,
        thirst: 50 + Math.random() * 50,
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
          stones: 0
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

  const update$ = sources.Time.periodic(1000 / 5);

  const state$ = update$.fold(update, initialState);

  return {
    DOM: state$.map(renderView)
  };
}

const drivers = {
  DOM: makeDOMDriver(".app"),
  Time: timeDriver
};

run(main, drivers);
